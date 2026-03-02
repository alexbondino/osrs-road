'use client';

export interface SidebarItem {
  id: string;
  label: string;
  emoji: string;
  category: string;
}

const ITEMS: SidebarItem[] = [
  // Skills
  { id: 'atk', label: 'Attack', emoji: '⚔️', category: 'Skill' },
  { id: 'str', label: 'Strength', emoji: '💪', category: 'Skill' },
  { id: 'def', label: 'Defence', emoji: '🛡️', category: 'Skill' },
  { id: 'range', label: 'Ranged', emoji: '🏹', category: 'Skill' },
  { id: 'magic', label: 'Magic', emoji: '🔮', category: 'Skill' },
  { id: 'prayer', label: 'Prayer', emoji: '✨', category: 'Skill' },
  { id: 'mining', label: 'Mining', emoji: '⛏️', category: 'Skill' },
  { id: 'fishing', label: 'Fishing', emoji: '🎣', category: 'Skill' },
  { id: 'cooking', label: 'Cooking', emoji: '🍖', category: 'Skill' },
  { id: 'crafting', label: 'Crafting', emoji: '🧵', category: 'Skill' },
  // Quests
  { id: 'q_cooks', label: "Cook's Assistant", emoji: '📜', category: 'Quest' },
  { id: 'q_romeo', label: 'Romeo & Juliet', emoji: '📜', category: 'Quest' },
  { id: 'q_sheep', label: 'Sheep Shearer', emoji: '📜', category: 'Quest' },
  { id: 'q_vampire', label: 'Vampire Slayer', emoji: '📜', category: 'Quest' },
  {
    id: 'q_waterfall',
    label: 'Waterfall Quest',
    emoji: '📜',
    category: 'Quest',
  },
  { id: 'q_dt', label: 'Desert Treasure', emoji: '📜', category: 'Quest' },
  // Equipment
  {
    id: 'bronze_sw',
    label: 'Bronze Sword',
    emoji: '🗡️',
    category: 'Equipment',
  },
  { id: 'iron_sw', label: 'Iron Scimitar', emoji: '🗡️', category: 'Equipment' },
  { id: 'rune_sw', label: 'Rune Scimitar', emoji: '🗡️', category: 'Equipment' },
  {
    id: 'iron_armor',
    label: 'Iron Armour',
    emoji: '🥋',
    category: 'Equipment',
  },
  {
    id: 'rune_armor',
    label: 'Rune Armour',
    emoji: '🥋',
    category: 'Equipment',
  },
  {
    id: 'amulet',
    label: 'Amulet of Glory',
    emoji: '📿',
    category: 'Equipment',
  },
  // Bosses
  { id: 'giant_rat', label: 'Giant Rat', emoji: '🐀', category: 'Boss' },
  { id: 'hill_giant', label: 'Hill Giant', emoji: '👹', category: 'Boss' },
  { id: 'moss_giant', label: 'Moss Giant', emoji: '🌿', category: 'Boss' },
  { id: 'kbd', label: 'King Black Dragon', emoji: '🐲', category: 'Boss' },
  { id: 'zulrah', label: 'Zulrah', emoji: '🐍', category: 'Boss' },
  { id: 'cerb', label: 'Cerberus', emoji: '🐕', category: 'Boss' },
];

const CATEGORIES = ['Skill', 'Quest', 'Equipment', 'Boss'];

function DraggableItem({ item }: { item: SidebarItem }) {
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/reactflow', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-700 hover:bg-zinc-600 cursor-grab active:cursor-grabbing border border-zinc-600 hover:border-amber-500 transition-colors select-none"
    >
      <span className="text-lg">{item.emoji}</span>
      <span className="text-white text-xs font-medium truncate">
        {item.label}
      </span>
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="w-56 shrink-0 bg-zinc-900 border-r border-zinc-700 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-700">
        <h2 className="text-white font-bold text-sm">Items</h2>
        <p className="text-zinc-400 text-xs mt-0.5">Arrastra al canvas</p>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {CATEGORIES.map(cat => (
          <div key={cat} className="mb-3">
            <div className="px-4 py-1">
              <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">
                {cat}
              </span>
            </div>
            <div className="px-2 flex flex-col gap-1">
              {ITEMS.filter(i => i.category === cat).map(item => (
                <DraggableItem key={item.id} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
