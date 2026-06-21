/**
 * 全局页脚隐私声明（design §5.6）。
 * 在每页底部声明本地优先边界：所有数据本地存储，不上传任何外部服务。
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
      所有数据本地存储，不上传任何外部服务
    </footer>
  );
}
