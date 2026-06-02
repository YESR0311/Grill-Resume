'use client';

import { useTranslations } from 'next-intl';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { EditableText } from '../fields/editable-text';
import { EditableList } from '../fields/editable-list';
import { generateId } from '@/lib/utils';
import type { ResumeSection, SkillsContent, SkillCategory } from '@/types/resume';

interface Props {
  section: ResumeSection;
  onUpdate: (content: Partial<SkillsContent>) => void;
}

interface SortableSkillCategoryItemProps {
  id: string;
  children: (dragHandleProps: {
    attributes: ReturnType<typeof useSortable>['attributes'];
    listeners: ReturnType<typeof useSortable>['listeners'];
  }) => React.ReactNode;
}

function SortableSkillCategoryItem({ id, children }: SortableSkillCategoryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners })}
    </div>
  );
}

export function SkillsSection({ section, onUpdate }: Props) {
  const t = useTranslations('editor.fields');
  const content = section.content as SkillsContent;
  const categories = content.categories || [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const getCategorySortableId = (category: SkillCategory, index: number) =>
    category.id || `category-${index}`;

  const addCategory = () => {
    const newCategory: SkillCategory = {
      id: generateId(),
      name: '',
      skills: [],
    };
    onUpdate({ categories: [...categories, newCategory] });
  };

  const updateCategory = (index: number, data: Partial<SkillCategory>) => {
    const updated = categories.map((cat, i) => (i === index ? { ...cat, ...data } : cat));
    onUpdate({ categories: updated });
  };

  const removeCategory = (index: number) => {
    onUpdate({ categories: categories.filter((_, i) => i !== index) });
  };

  const reorderCategories = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((category, index) => getCategorySortableId(category, index) === active.id);
    const newIndex = categories.findIndex((category, index) => getCategorySortableId(category, index) === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    onUpdate({ categories: arrayMove(categories, oldIndex, newIndex) });
  };

  return (
    <div className="space-y-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderCategories}>
        <SortableContext items={categories.map(getCategorySortableId)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {categories.map((cat, index) => (
              <SortableSkillCategoryItem key={getCategorySortableId(cat, index)} id={getCategorySortableId(cat, index)}>
                {({ attributes, listeners }) => (
                  <div>
                    {index > 0 && <Separator className="mb-4" />}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                          <button
                            type="button"
                            className="mt-5 flex h-7 w-7 cursor-grab items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-500 active:cursor-grabbing dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                            aria-label={t('reorderItem')}
                            title={t('reorderItem')}
                            {...attributes}
                            {...listeners}
                          >
                            <GripVertical className="h-3.5 w-3.5" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <EditableText label={t('skillCategory')} value={cat.name} onChange={(v) => updateCategory(index, { name: v })} />
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="mt-5 h-7 cursor-pointer p-1 text-zinc-400 hover:text-red-500" onClick={() => removeCategory(index)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <EditableList label={t('technologies')} items={cat.skills} onChange={(v) => updateCategory(index, { skills: v })} />
                    </div>
                  </div>
                )}
              </SortableSkillCategoryItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <Button variant="outline" size="sm" onClick={addCategory} className="w-full cursor-pointer gap-1">
        <Plus className="h-3.5 w-3.5" />
        {t('addItem')}
      </Button>
    </div>
  );
}
