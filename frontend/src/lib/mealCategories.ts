export type FoodGroupId = "protein" | "rice" | "snack"

export interface FoodGroupTarget {
  calories: number
  percent: number
}

export type PersonFoodGroupTargets = Record<FoodGroupId, FoodGroupTarget>

export const MALE_FOOD_GROUP_TARGETS: PersonFoodGroupTargets = {
  protein: { calories: 910, percent: 46 },
  rice: { calories: 450, percent: 23 },
  snack: { calories: 640, percent: 31 },
}

export const FEMALE_FOOD_GROUP_TARGETS: PersonFoodGroupTargets = {
  protein: { calories: 840, percent: 65 },
  rice: { calories: 250, percent: 19 },
  snack: { calories: 210, percent: 16 },
}

export const ALL_FOOD_GROUP_TARGETS: PersonFoodGroupTargets = {
  protein: {
    calories: MALE_FOOD_GROUP_TARGETS.protein.calories + FEMALE_FOOD_GROUP_TARGETS.protein.calories,
    percent: Math.round(((910 + 840) / 3300) * 100),
  },
  rice: {
    calories: MALE_FOOD_GROUP_TARGETS.rice.calories + FEMALE_FOOD_GROUP_TARGETS.rice.calories,
    percent: Math.round(((450 + 250) / 3300) * 100),
  },
  snack: {
    calories: MALE_FOOD_GROUP_TARGETS.snack.calories + FEMALE_FOOD_GROUP_TARGETS.snack.calories,
    percent: Math.round(((640 + 210) / 3300) * 100),
  },
}

export function getFoodGroupTargets(selectedPerson: string): PersonFoodGroupTargets {
  if (selectedPerson === "ฝ่ายหญิง") return FEMALE_FOOD_GROUP_TARGETS
  if (selectedPerson === "ฝ่ายชาย") return MALE_FOOD_GROUP_TARGETS
  return ALL_FOOD_GROUP_TARGETS
}

export interface FoodGroupMeta {
  id: FoodGroupId
  order: number
  label: string
  shortLabel: string
  dotClass: string
  barClass: string
  badgeClass: string
  borderClass: string
  headerBgClass: string
  kcalTextClass: string
}

export const FOOD_GROUPS: FoodGroupMeta[] = [
  {
    id: "protein",
    order: 1,
    label: "1. เนื้อสัตว์ & โปรตีน",
    shortLabel: "เนื้อสัตว์",
    dotClass: "bg-indigo-500",
    barClass: "bg-indigo-500",
    badgeClass: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    borderClass: "border-indigo-500/25",
    headerBgClass: "bg-indigo-500/10",
    kcalTextClass: "text-indigo-300",
  },
  {
    id: "rice",
    order: 2,
    label: "2. ข้าวสวย",
    shortLabel: "ข้าว",
    dotClass: "bg-amber-400",
    barClass: "bg-amber-400",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    borderClass: "border-amber-500/25",
    headerBgClass: "bg-amber-500/10",
    kcalTextClass: "text-amber-300",
  },
  {
    id: "snack",
    order: 3,
    label: "3. ของทานเล่น & เครื่องดื่ม",
    shortLabel: "ของทานเล่น",
    dotClass: "bg-purple-500",
    barClass: "bg-purple-500",
    badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    borderClass: "border-purple-500/25",
    headerBgClass: "bg-purple-500/10",
    kcalTextClass: "text-purple-300",
  },
]

const PROTEIN_SUPPLEMENT_KEYWORDS = [
  "โปรตีน",
  "เวย์",
  "whey",
  "plante",
  "plantae",
  "protein",
  "soy protein",
  "isolate",
]

const RICE_KEYWORDS = [
  "ข้าวสวย",
  "ข้าวกล้อง",
  "ข้าวไรซ์เบอร์รี่",
  "ข้าวเหนียว",
  "ข้าวญี่ปุ่น",
  "ข้าวโอ๊ต",
  "ข้าวต้ม",
  "ข้าวเปล่า",
  "ข้าวหอมมะลิ",
  "ข้าว",
]

const RICE_SNACK_EXCEPTIONS = ["ข้าวโพดคั่ว", "ข้าวเกรียบ", "ข้าวแต๋น", "ข้าวตัง", "ข้าวหลาม", "ข้าวเหนียวมะม่วง"]

const SNACK_DRINK_KEYWORDS = [
  "ไส้กรอก",
  "ลูกชิ้น",
  "นักเก็ต",
  "เฟรนช์ฟราย",
  "กล้วย",
  "แอปเปิ้ล",
  "ส้ม",
  "แตงโม",
  "มะม่วง",
  "ฝรั่ง",
  "องุ่น",
  "สตรอว์เบอร์รี่",
  "ผลไม้",
  "ชา",
  "กาแฟ",
  "โกโก้",
  "ลาเต้",
  "อเมริกาโน่",
  "เอสเพรสโซ่",
  "คาปูชิโน่",
  "มัทฉะ",
  "นมเปรี้ยว",
  "โยเกิร์ต",
  "น้ำอัดลม",
  "น้ำผลไม้",
  "น้ำหวาน",
  "พร้อมดื่ม",
  "เครื่องดื่ม",
  "ขนม",
  "เค้ก",
  "คุกกี้",
  "บราวนี่",
  "ไอติม",
  "ไอศกรีม",
  "ช็อกโกแลต",
  "เบเกอรี่",
  "โดนัท",
  "ครัวซองต์",
  "วาฟเฟิล",
  "แพนเค้ก",
  "ถั่ว",
  "อัลมอนด์",
  "เมล็ด",
  "เยลลี่",
  "พุดดิ้ง",
  "ทาโร่",
  "เลย์",
  "ป๊อปคอร์น",
]

const MEAT_PROTEIN_KEYWORDS = [
  "หมู",
  "สันคอ",
  "สันใน",
  "สามชั้น",
  "เบคอน",
  "ไก่",
  "อกไก่",
  "สะโพก",
  "น่อง",
  "เนื้อ",
  "วัว",
  "เป็ด",
  "ปลา",
  "แซลมอน",
  "ทูน่า",
  "ดอลลี่",
  "ซาบะ",
  "กุ้ง",
  "หมึก",
  "ปู",
  "หอย",
  "ทะเล",
  "ไข่",
  "เต้าหู้",
  "สเต็ก",
  "ผัดพริกแกง",
  "ผัดซีอิ๊ว",
  "ผัดกะเพรา",
  "กระเพรา",
  "ต้มยำ",
  "ต้มจืด",
  "แกง",
  "ลาบ",
  "น้ำตก",
  "ยำ",
  "ย่าง",
  "นึ่ง",
  "อบ",
]

export function classifyMealGroup(meal: any): FoodGroupId {
  const name = String(meal.foodName || meal.FoodName || "").toLowerCase().trim()

  // 1. Protein shakes / supplements first (e.g. "โปรตีน Plante รสช็อกโกแลต")
  if (PROTEIN_SUPPLEMENT_KEYWORDS.some((kw) => name.includes(kw))) {
    return "protein"
  }

  // 2. Rice / main carb (excluding rice-based snacks)
  if (
    !RICE_SNACK_EXCEPTIONS.some((ex) => name.includes(ex)) &&
    RICE_KEYWORDS.some((kw) => name.includes(kw))
  ) {
    return "rice"
  }

  // 3. Snacks & drinks (checked before generic meat so "ไส้กรอกไก่" lands in snacks)
  if (SNACK_DRINK_KEYWORDS.some((kw) => name.includes(kw))) {
    return "snack"
  }

  // 4. Meat & protein dishes
  if (MEAT_PROTEIN_KEYWORDS.some((kw) => name.includes(kw))) {
    return "protein"
  }

  // 5. Fallback by macro profile
  const protein = Number(meal.protein || meal.Protein || 0)
  const carbs = Number(meal.carbs || meal.Carbs || 0)
  if (protein >= carbs && protein >= 10) {
    return "protein"
  }

  return "snack"
}

export interface GroupedMealsSummary {
  group: FoodGroupMeta
  meals: any[]
  calories: number
  protein: number
  carbs: number
  fat: number
  percent: number
}

export function groupMealsByFoodCategory(meals: any[]): GroupedMealsSummary[] {
  const buckets: Record<FoodGroupId, any[]> = {
    protein: [],
    rice: [],
    snack: [],
  }

  meals.forEach((meal) => {
    const groupId = classifyMealGroup(meal)
    buckets[groupId].push(meal)
  })

  const totalKcal = meals.reduce((sum, m) => sum + Number(m.calories || m.Calories || 0), 0)

  return FOOD_GROUPS.map((group) => {
    const items = buckets[group.id]
    const calories = items.reduce((s, m) => s + Number(m.calories || m.Calories || 0), 0)
    const protein = Number(items.reduce((s, m) => s + Number(m.protein || m.Protein || 0), 0).toFixed(1))
    const carbs = Number(items.reduce((s, m) => s + Number(m.carbs || m.Carbs || 0), 0).toFixed(1))
    const fat = Number(items.reduce((s, m) => s + Number(m.fat || m.Fat || 0), 0).toFixed(1))
    const percent = totalKcal > 0 ? Math.round((calories / totalKcal) * 100) : 0

    return {
      group,
      meals: items,
      calories: Math.round(calories),
      protein,
      carbs,
      fat,
      percent,
    }
  })
}
