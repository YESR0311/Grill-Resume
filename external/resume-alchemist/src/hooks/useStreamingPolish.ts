import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface StreamingPolishOptions {
  onChunk?: (text: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: string) => void;
}

export function useStreamingPolish() {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const streamPolishFull = useCallback(async (
    content: string, 
    industry: string,
    options: StreamingPolishOptions = {}
  ) => {
    setIsStreaming(true);
    abortControllerRef.current = new AbortController();
    
    let fullText = '';
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resume-ai-stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            type: 'polish_full',
            content,
            industry,
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '请求失败');
      }

      if (!response.body) {
        throw new Error('流式响应不可用');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 处理 SSE 格式
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              options.onChunk?.(fullText);
            }
          } catch {
            // 可能是不完整的 JSON，放回 buffer
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // 处理剩余内容
      if (buffer.trim()) {
        for (let raw of buffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
            }
          } catch { /* ignore */ }
        }
      }

      options.onComplete?.(fullText);
      return fullText;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return null;
      }
      const message = error instanceof Error ? error.message : '润色失败';
      toast.error(message);
      options.onError?.(message);
      return null;
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, []);

  const streamPolishSentence = useCallback(async (
    content: string,
    industry: string,
    style: 'standard' | 'data' | 'expert',
    options: StreamingPolishOptions = {}
  ) => {
    setIsStreaming(true);
    abortControllerRef.current = new AbortController();
    
    let fullText = '';
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resume-ai-stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            type: 'polish_sentence',
            content,
            industry,
            style,
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '请求失败');
      }

      if (!response.body) {
        throw new Error('流式响应不可用');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              options.onChunk?.(fullText);
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      options.onComplete?.(fullText);
      return fullText;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return null;
      }
      const message = error instanceof Error ? error.message : '润色失败';
      toast.error(message);
      options.onError?.(message);
      return null;
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, []);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    isStreaming,
    streamPolishFull,
    streamPolishSentence,
    abort,
  };
}
