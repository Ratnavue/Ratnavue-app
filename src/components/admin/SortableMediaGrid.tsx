"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, GripVertical, Star, Trash2, Video } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GalleryItem {
  id: string;
  url: string;
  type: string;
  altText?: string | null;
}

/** An arrangeable photo/video grid. Drag a tile to reorder (mouse), or use its
 * arrow buttons (touch, keyboard); the star makes a tile the first image. The
 * first tile is the one shown on the catalog cards and as the product's main
 * photo. The grid only reports the new order via onReorder — where it's
 * saved is the caller's business. */
export function SortableMediaGrid({
  items,
  onReorder,
  onRemove,
  disabled = false,
}: {
  items: GalleryItem[];
  onReorder: (orderedIds: string[]) => void;
  onRemove?: (id: string) => void;
  disabled?: boolean;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  function move(from: number, to: number) {
    if (disabled || from === to || to < 0 || to >= items.length) return;
    const ids = items.map((i) => i.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    onReorder(ids);
  }

  if (items.length === 0) return <p className="text-sm text-charcoal/65">No photos or videos yet.</p>;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item, index) => {
        const first = index === 0;
        return (
          <li
            key={item.id}
            draggable={!disabled}
            onDragStart={() => setDragId(item.id)}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              setOverId(item.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId && dragId !== item.id) move(items.findIndex((i) => i.id === dragId), index);
              setDragId(null);
              setOverId(null);
            }}
            className={cn(
              "group relative aspect-square overflow-hidden rounded-lg border-2 bg-ivory-soft transition",
              first ? "border-gold" : "border-border-subtle",
              overId === item.id && dragId !== item.id && "ring-2 ring-gold/60",
              dragId === item.id && "opacity-40",
              !disabled && "cursor-grab active:cursor-grabbing",
            )}
          >
            {item.type === "VIDEO" ? (
              <video src={item.url} muted preload="metadata" playsInline className="pointer-events-none h-full w-full object-cover" />
            ) : (
              <Image src={item.url} alt={item.altText ?? ""} fill sizes="(min-width: 1024px) 20vw, (min-width: 640px) 30vw, 45vw" className="pointer-events-none object-cover" draggable={false} />
            )}

            <div className="pointer-events-none absolute left-1.5 top-1.5 flex items-center gap-1">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", first ? "bg-gold text-night" : "bg-night/70 text-cream")}>
                {first ? "First image" : index + 1}
              </span>
              {item.type === "VIDEO" && (
                <span className="flex items-center gap-1 rounded-full bg-night/70 px-1.5 py-0.5 text-[10px] text-cream">
                  <Video size={10} /> Video
                </span>
              )}
            </div>
            {!disabled && <GripVertical size={16} className="pointer-events-none absolute right-1.5 top-1.5 text-cream drop-shadow" aria-hidden />}

            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-night/65 p-1 text-cream">
              <div className="flex items-center">
                <button type="button" aria-label="Move earlier" disabled={disabled || index === 0} onClick={() => move(index, index - 1)} className="rounded p-1.5 hover:bg-ivory/20 disabled:opacity-30">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" aria-label="Move later" disabled={disabled || index === items.length - 1} onClick={() => move(index, index + 1)} className="rounded p-1.5 hover:bg-ivory/20 disabled:opacity-30">
                  <ChevronRight size={16} />
                </button>
                {!first && (
                  <button type="button" aria-label="Make this the first image" title="Make first image" disabled={disabled} onClick={() => move(index, 0)} className="rounded p-1.5 hover:bg-ivory/20 disabled:opacity-30">
                    <Star size={15} />
                  </button>
                )}
              </div>
              {onRemove && (
                <button type="button" aria-label="Remove" title="Remove" disabled={disabled} onClick={() => onRemove(item.id)} className="rounded p-1.5 hover:bg-ivory/20 disabled:opacity-30">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
