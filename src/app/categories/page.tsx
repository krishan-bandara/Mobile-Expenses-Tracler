"use client";

// Client-side auth/data pages have no static content worth pre-rendering
// at build time, and doing so made the build depend on live Supabase
// config being valid at image-build time. Force per-request rendering.
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Archive,
  Tag,
  ShoppingCart,
  Car,
  Utensils,
  FileText,
  HeartPulse,
  Wallet,
  PlusCircle,
  Landmark,
  HeartHandshake,
  Home,
  Briefcase,
  Gift,
  Plane,
  BookOpen,
  Coffee,
  Shirt,
  Dumbbell,
  Film,
  Music,
  GraduationCap,
  Fuel,
  PiggyBank,
  Smartphone,
  Sparkles,
  type LucideIcon
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LockCheck } from "@/components/LockCheck";
import { SkeletonList } from "@/components/Skeleton";
import type { Category } from "@/lib/types";

// Preset swatches — keeps every category visually consistent with the
// rest of the app instead of opening up arbitrary hex input. 16 colors
// spaced evenly around the hue wheel so no two are ever a close call.
const SWATCHES = [
  { name: "Rose", bg: "#FEE7EF", fg: "#B3123A", dot: "#FB7BA2" },
  { name: "Orange", bg: "#FFEDD5", fg: "#C2410C", dot: "#FB923C" },
  { name: "Amber", bg: "#FEF1DE", fg: "#9A5B08", dot: "#FCC26D" },
  { name: "Yellow", bg: "#FEF6DC", fg: "#92610A", dot: "#FCD34D" },
  { name: "Lime", bg: "#ECFCCB", fg: "#4D7C0F", dot: "#A3E635" },
  { name: "Green", bg: "#DCFCE7", fg: "#15803D", dot: "#4ADE80" },
  { name: "Emerald", bg: "#D9F7E6", fg: "#12854A", dot: "#34D399" },
  { name: "Teal", bg: "#DFF9F4", fg: "#0B6E60", dot: "#5EEAD4" },
  { name: "Cyan", bg: "#CFFAFE", fg: "#0E7490", dot: "#22D3EE" },
  { name: "Sky", bg: "#E0F2FE", fg: "#0369A1", dot: "#38BDF8" },
  { name: "Blue", bg: "#E0EDFE", fg: "#1D4ED8", dot: "#60A5FA" },
  { name: "Indigo", bg: "#E4E4F2", fg: "#3730A3", dot: "#818CF8" },
  { name: "Violet", bg: "#EFE8FE", fg: "#6D28D9", dot: "#A78BFA" },
  { name: "Purple", bg: "#F3E8FF", fg: "#7E22CE", dot: "#C084FC" },
  { name: "Fuchsia", bg: "#FAE8FF", fg: "#A21CAF", dot: "#E879F9" },
  { name: "Pink", bg: "#FCE7F3", fg: "#9D174D", dot: "#F472B6" }
];

// Named imports rather than lucide-react's dynamic-by-string lookup —
// that pattern (used elsewhere for rendering already-saved icons) pulls
// in the entire icon library into the bundle because the bundler can't
// tell ahead of time which icons are used. A fixed picker like this one
// doesn't have that excuse, so it gets proper tree-shaking instead.
const ICONS: { name: string; Icon: LucideIcon }[] = [
  { name: "tag", Icon: Tag },
  { name: "shopping-cart", Icon: ShoppingCart },
  { name: "car", Icon: Car },
  { name: "utensils", Icon: Utensils },
  { name: "file-text", Icon: FileText },
  { name: "heart-pulse", Icon: HeartPulse },
  { name: "wallet", Icon: Wallet },
  { name: "plus-circle", Icon: PlusCircle },
  { name: "landmark", Icon: Landmark },
  { name: "heart-handshake", Icon: HeartHandshake },
  { name: "home", Icon: Home },
  { name: "briefcase", Icon: Briefcase },
  { name: "gift", Icon: Gift },
  { name: "plane", Icon: Plane },
  { name: "book-open", Icon: BookOpen },
  { name: "coffee", Icon: Coffee },
  { name: "shirt", Icon: Shirt },
  { name: "dumbbell", Icon: Dumbbell },
  { name: "film", Icon: Film },
  { name: "music", Icon: Music },
  { name: "graduation-cap", Icon: GraduationCap },
  { name: "fuel", Icon: Fuel },
  { name: "piggy-bank", Icon: PiggyBank },
  { name: "smartphone", Icon: Smartphone },
  { name: "sparkles", Icon: Sparkles }
];

function iconFor(name: string): LucideIcon {
  return ICONS.find((i) => i.name === name)?.Icon ?? Tag;
}

export default function CategoriesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [newSwatch, setNewSwatch] = useState(0);
  const [newIcon, setNewIcon] = useState("tag");
  const [openPicker, setOpenPicker] = useState<{ id: string; kind: "color" | "icon" } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const { data } = await supabase.from("categories").select("*").eq("archived", false).order("sort_order");
    setCategories((data ?? []) as Category[]);
    setLoading(false);
  }

  // Every mutation in this page goes through window.confirm() first —
  // this page is exactly where a category got accidentally archived
  // with a single unconfirmed click, so add/rename/recolor/re-icon/
  // delete all require an explicit yes now, not just a click.

  async function addCategory() {
    const name = newName.trim();
    if (!name) return;
    if (!confirm(`Add "${name}" as a new category?`)) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    const swatch = SWATCHES[newSwatch];
    await supabase.from("categories").insert({
      user_id: user.id,
      name,
      icon: newIcon,
      color_bg: swatch.bg,
      color_fg: swatch.fg,
      color_dot: swatch.dot,
      sort_order: categories.length
    });
    setNewName("");
    setNewIcon("tag");
    void load();
  }

  async function rename(id: string, oldName: string, newValue: string, revert: () => void) {
    const name = newValue.trim();
    if (!name || name === oldName) {
      revert();
      return;
    }
    if (!confirm(`Rename "${oldName}" to "${name}"?`)) {
      revert();
      return;
    }
    setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, name } : c)));
    await supabase.from("categories").update({ name }).eq("id", id);
  }

  async function recolor(id: string, categoryName: string, swatchIndex: number) {
    const swatch = SWATCHES[swatchIndex];
    if (!confirm(`Change ${categoryName}'s color to ${swatch.name}?`)) return;
    setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, color_bg: swatch.bg, color_fg: swatch.fg, color_dot: swatch.dot } : c)));
    await supabase.from("categories").update({ color_bg: swatch.bg, color_fg: swatch.fg, color_dot: swatch.dot }).eq("id", id);
    setOpenPicker(null);
  }

  async function changeIcon(id: string, categoryName: string, iconName: string) {
    if (!confirm(`Change ${categoryName}'s icon?`)) return;
    setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, icon: iconName } : c)));
    await supabase.from("categories").update({ icon: iconName }).eq("id", id);
    setOpenPicker(null);
  }

  async function archive(id: string, name: string) {
    if (!confirm(`Delete "${name}"? It won't show up when adding new expenses. Past transactions keep showing it — nothing gets lost, but you'd need to come back here to bring it back.`)) {
      return;
    }
    setCategories((cs) => cs.filter((c) => c.id !== id));
    await supabase.from("categories").update({ archived: true }).eq("id", id);
  }

  const usedDots = new Set(categories.map((c) => c.color_dot));

  return (
    <>
      <LockCheck />
      <div className="flex items-center gap-3 px-[18px] pt-[18px] pb-1">
        <button
          type="button"
          onClick={() => router.push("/settings")}
          aria-label="Back to settings"
          className="w-11 h-11 rounded-2xl bg-card flex items-center justify-center shrink-0"
        >
          <ArrowLeft size={20} strokeWidth={2.2} />
        </button>
        <h1 className="flex-grow text-[17px] font-bold">Categories</h1>
      </div>

      <div className="mx-[18px] mt-3 bg-card rounded-xl2 p-4">
        <label htmlFor="new-category" className="block text-xs text-muted mb-2">
          Add a category
        </label>
        <div className="flex gap-2">
          <input
            id="new-category"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Pets"
            className="flex-grow h-11 rounded-xl bg-surface px-3 text-[15px] outline-none"
          />
          <button type="button" onClick={addCategory} aria-label="Add category" className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
            <Plus size={20} />
          </button>
        </div>

        <div className="text-xs text-muted mt-3 mb-1.5">Color</div>
        <div className="flex gap-2 flex-wrap">
          {SWATCHES.map((s, i) => {
            const inUse = usedDots.has(s.dot) && i !== newSwatch;
            return (
              <button
                key={s.name}
                type="button"
                aria-label={`${s.name}${inUse ? " (already used)" : ""}`}
                aria-pressed={newSwatch === i}
                onClick={() => setNewSwatch(i)}
                className={"relative w-8 h-8 rounded-full " + (newSwatch === i ? "ring-2 ring-offset-2 ring-primary" : "")}
                style={{ background: s.dot, opacity: inUse ? 0.35 : 1 }}
              />
            );
          })}
        </div>

        <div className="text-xs text-muted mt-3 mb-1.5">Icon</div>
        <div className="flex gap-2 flex-wrap">
          {ICONS.map(({ name, Icon }) => (
            <button
              key={name}
              type="button"
              aria-label={name.replace(/-/g, " ")}
              aria-pressed={newIcon === name}
              onClick={() => setNewIcon(name)}
              className={
                "w-9 h-9 rounded-xl flex items-center justify-center " +
                (newIcon === name ? "bg-primary text-white" : "bg-surface text-ink")
              }
            >
              <Icon size={17} strokeWidth={1.9} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex-grow mx-[18px] mt-3 bg-card rounded-xl2 px-4 overflow-hidden">
        {loading ? (
          <SkeletonList />
        ) : (
          categories.map((c) => {
            const CategoryIcon = iconFor(c.icon);
            return (
              <div key={c.id} className="py-3 border-t border-border first:border-t-0">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label={`Change ${c.name}'s icon`}
                    onClick={() => setOpenPicker(openPicker?.id === c.id && openPicker.kind === "icon" ? null : { id: c.id, kind: "icon" })}
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: c.color_bg }}
                  >
                    <CategoryIcon size={17} color={c.color_fg} strokeWidth={1.9} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Change ${c.name}'s color`}
                    onClick={() => setOpenPicker(openPicker?.id === c.id && openPicker.kind === "color" ? null : { id: c.id, kind: "color" })}
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ background: c.color_dot }}
                  />
                  <input
                    defaultValue={c.name}
                    onBlur={(e) => {
                      const el = e.target;
                      rename(c.id, c.name, el.value, () => {
                        el.value = c.name;
                      });
                    }}
                    className="flex-grow min-w-0 text-[15px] font-semibold bg-transparent outline-none"
                  />
                  <button type="button" onClick={() => archive(c.id, c.name)} aria-label={`Delete ${c.name}`} className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center shrink-0">
                    <Archive size={16} />
                  </button>
                </div>

                {openPicker?.id === c.id && openPicker.kind === "color" && (
                  <div className="flex gap-1.5 mt-2.5 ml-11 flex-wrap">
                    {SWATCHES.map((s, i) => (
                      <button
                        key={s.name}
                        type="button"
                        aria-label={`Recolor to ${s.name}`}
                        onClick={() => recolor(c.id, c.name, i)}
                        className={"w-6 h-6 rounded-full " + (c.color_dot === s.dot ? "ring-2 ring-offset-1 ring-primary" : "")}
                        style={{ background: s.dot }}
                      />
                    ))}
                  </div>
                )}

                {openPicker?.id === c.id && openPicker.kind === "icon" && (
                  <div className="flex gap-1.5 mt-2.5 ml-11 flex-wrap">
                    {ICONS.map(({ name, Icon }) => (
                      <button
                        key={name}
                        type="button"
                        aria-label={name.replace(/-/g, " ")}
                        onClick={() => changeIcon(c.id, c.name, name)}
                        className={
                          "w-8 h-8 rounded-lg flex items-center justify-center " +
                          (c.icon === name ? "bg-primary text-white" : "bg-surface text-ink")
                        }
                      >
                        <Icon size={15} strokeWidth={1.9} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <div className="pb-8" />
    </>
  );
}
