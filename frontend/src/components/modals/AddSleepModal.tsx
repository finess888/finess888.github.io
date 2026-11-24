import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  SleepQuality,
  calculateSleepDuration,
  getSleepGoal,
  saveSleepGoal,
  getSleepLogs,
  saveSleepLog,
  evaluateSleepStatus,
} from "@/lib/sleepTracker"
import { callGasApi } from "@/api/gasClient"
import { Moon, Sun, Clock, Target, Sparkles } from "lucide-react"
import { toast } from "sonner"

interface AddSleepModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultPerson?: string
  initialDate?: string
  onSaved?: () => void
}

const BEDTIME_PRESETS = ["21:30", "22:00", "22:30", "23:00", "23:30", "00:00", "00:30", "01:00"]
const WAKETIME_PRESETS = ["05:30", "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00"]
const QUALITY_OPTIONS: { value: SleepQuality; label: string; emoji: string }[] = [
  { value: "ดีมาก (Deep)", label: "หลับสนิท / สดชื่น", emoji: "🌟" },
  { value: "ปกติ (Normal)", label: "ปกติ", emoji: "😊" },
  { value: "หลับไม่สนิท (Light)", label: "หลับๆ ตื่นๆ", emoji: "😐" },
  { value: "เพลีย/นอนน้อย (Poor)", label: "เพลีย / นอนไม่พอ", emoji: "🥱" },
]

export function AddSleepModal({
  open,
  onOpenChange,
  defaultPerson = "ฝ่ายชาย",
  initialDate,
  onSaved,
}: AddSleepModalProps) {
  const todayStr = new Date().toLocaleDateString("en-CA")
  const [date, setDate] = React.useState(todayStr)
  const [person, setPerson] = React.useState<"ฝ่ายชาย" | "ฝ่ายหญิง">(
    defaultPerson === "ฝ่ายหญิง" ? "ฝ่ายหญิง" : "ฝ่ายชาย"
  )
  const [bedTime, setBedTime] = React.useState("23:00")
  const [wakeTime, setWakeTime] = React.useState("07:00")
  const [quality, setQuality] = React.useState<SleepQuality>("ปกติ (Normal)")
  const [sleepGoalHours, setSleepGoalHours] = React.useState<number>(8)
  const [notes, setNotes] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  // Load existing entry if available for this person & date
  const loadExistingForPersonDate = React.useCallback(
    (targetPerson: "ฝ่ายชาย" | "ฝ่ายหญิง", targetDate: string) => {
      const pGoal = getSleepGoal(targetPerson)
      setSleepGoalHours(pGoal)

      const existing = getSleepLogs().find(
        (l) => l.person === targetPerson && l.date === targetDate
      )
      if (existing) {
        setBedTime(existing.bedTime || "23:00")
        setWakeTime(existing.wakeTime || "07:00")
        setQuality(existing.quality || "ปกติ (Normal)")
        setSleepGoalHours(existing.sleepGoalHours || pGoal)
        setNotes(existing.notes || "")
      } else {
        setBedTime("23:00")
        setWakeTime("07:00")
        setQuality("ปกติ (Normal)")
        setNotes("")
      }
    },
    []
  )

  React.useEffect(() => {
    if (open) {
      const activeP = defaultPerson === "ฝ่ายหญิง" ? "ฝ่ายหญิง" : "ฝ่ายชาย"
      const activeD = initialDate || new Date().toLocaleDateString("en-CA")
      setPerson(activeP)
      setDate(activeD)
      loadExistingForPersonDate(activeP, activeD)
    }
  }, [open, defaultPerson, initialDate, loadExistingForPersonDate])

  const handlePersonSwitch = (newP: "ฝ่ายชาย" | "ฝ่ายหญิง") => {
    setPerson(newP)
    loadExistingForPersonDate(newP, date)
  }

  const handleDateChange = (newD: string) => {
    setDate(newD)
    loadExistingForPersonDate(person, newD)
  }

  const duration = calculateSleepDuration(bedTime, wakeTime)
  const sleepEval = evaluateSleepStatus(duration.totalHoursDecimal, sleepGoalHours)
  const progressPct = Math.min(
    100,
    Math.round((duration.totalHoursDecimal / (sleepGoalHours || 8)) * 100)
  )

  const handleSetNowBedtime = () => {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, "0")
    const mm = String(now.getMinutes()).padStart(2, "0")
    setBedTime(`${hh}:${mm}`)
  }

  const handleSetNowWaketime = () => {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, "0")
    const mm = String(now.getMinutes()).padStart(2, "0")
    setWakeTime(`${hh}:${mm}`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bedTime || !wakeTime) {
      toast.warning("กรุณาระบุเวลาเข้านอนและเวลาตื่นนอน")
      return
    }

    setSaving(true)
    try {
      saveSleepLog({
        id: "sleep-" + Date.now(),
        date,
        person,
        bedTime,
        wakeTime,
        durationMinutes: duration.totalMinutes,
        durationHours: duration.totalHoursDecimal,
        quality,
        sleepGoalHours,
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
      })

      // Sync summary to Google Sheets (B หน้าจดบันทึก)
      await callGasApi("ADD_SLEEP_LOG", {
        date,
        person,
        bedTime,
        wakeTime,
        durationMinutes: duration.totalMinutes,
        durationHours: duration.totalHoursDecimal,
        formattedDuration: duration.formatted,
        quality,
        notes: notes.trim(),
      }).catch((err) => {
        console.warn("GAS notice:", err.message)
      })

      toast.success(`บันทึกเวลานอน ${person} สำเร็จ! (${duration.formatted})`, {
        description: `เข้านอน ${bedTime} น. • ตื่น ${wakeTime} น. • ${sleepEval.label}`,
      })

      if (onSaved) onSaved()
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการบันทึกเวลานอน")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#111726] border-[#26334d] text-white p-6 rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
            <Moon className="h-5 w-5 text-indigo-400" />
            บันทึกเวลานอน & เวลาตื่น (Sleep Tracker)
          </DialogTitle>
          <p className="text-xs text-slate-400">
            การนอนหลับที่เพียงพอช่วยลดฮอร์โมนความเครียด (Cortisol) และเร่งการเผาผลาญไขมัน
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {/* Person & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200 font-medium">บุคคล</Label>
              <div className="flex rounded-lg bg-[#0b0f19] p-1 border border-[#26334d]">
                <button
                  type="button"
                  onClick={() => handlePersonSwitch("ฝ่ายชาย")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    person === "ฝ่ายชาย"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  🏋️‍♂️ ชาย
                </button>
                <button
                  type="button"
                  onClick={() => handlePersonSwitch("ฝ่ายหญิง")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    person === "ฝ่ายหญิง"
                      ? "bg-pink-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  🧘‍♀️ หญิง
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-200 font-medium">วันที่ตื่น / วันที่บันทึก</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-[#0b0f19] border-[#26334d] text-white text-xs h-9"
                required
              />
            </div>
          </div>

          {/* Bedtime & Wake Time Inputs */}
          <div className="grid grid-cols-2 gap-3">
            {/* Bedtime Box */}
            <div className="p-3 rounded-xl bg-[#0b0f19] border border-indigo-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-indigo-300 font-semibold flex items-center gap-1.5">
                  <Moon className="h-3.5 w-3.5 text-indigo-400" />
                  เวลาเข้านอน
                </Label>
                <button
                  type="button"
                  onClick={handleSetNowBedtime}
                  className="text-[10px] text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 px-1.5 py-0.5 rounded border border-indigo-500/30 transition-colors"
                >
                  ตอนนี้
                </button>
              </div>
              <Input
                type="time"
                value={bedTime}
                onChange={(e) => setBedTime(e.target.value)}
                className="bg-[#111726] border-[#26334d] text-white text-lg font-extrabold text-center h-11 font-mono focus:ring-1 focus:ring-indigo-400"
                required
              />
              <div className="flex flex-wrap gap-1 pt-0.5">
                {BEDTIME_PRESETS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setBedTime(t)}
                    className={`text-[10px] px-1.5 py-0.5 rounded border font-mono transition-all ${
                      bedTime === t
                        ? "bg-indigo-600 text-white border-indigo-400 font-bold"
                        : "bg-[#111726] text-slate-400 border-[#26334d] hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Wake Time Box */}
            <div className="p-3 rounded-xl bg-[#0b0f19] border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                  เวลาตื่นนอน
                </Label>
                <button
                  type="button"
                  onClick={handleSetNowWaketime}
                  className="text-[10px] text-amber-400 hover:text-slate-950 bg-amber-500/10 hover:bg-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 transition-colors"
                >
                  ตอนนี้
                </button>
              </div>
              <Input
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                className="bg-[#111726] border-[#26334d] text-white text-lg font-extrabold text-center h-11 font-mono focus:ring-1 focus:ring-amber-400"
                required
              />
              <div className="flex flex-wrap gap-1 pt-0.5">
                {WAKETIME_PRESETS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setWakeTime(t)}
                    className={`text-[10px] px-1.5 py-0.5 rounded border font-mono transition-all ${
                      wakeTime === t
                        ? "bg-amber-500 text-slate-950 border-amber-400 font-bold"
                        : "bg-[#111726] text-slate-400 border-[#26334d] hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Calculated Sleep Summary Card */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#0b1426] to-[#151c36] border border-indigo-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-400" />
                <span className="text-xs text-slate-300 font-medium">ระยะเวลานอนหลับรวม:</span>
              </div>
              <Badge className={`text-[10px] px-2 py-0.5 ${sleepEval.badgeClass}`}>
                {sleepEval.label}
              </Badge>
            </div>

            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-extrabold text-white font-mono">
                {duration.formatted}
                <span className="text-xs font-normal text-slate-400 ml-1.5">
                  ({duration.totalHoursDecimal} ชม.)
                </span>
              </div>
              <div className="text-xs font-mono text-indigo-300">
                🌙 {bedTime} ➔ ☀️ {wakeTime} ({progressPct}%)
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  sleepEval.status === "optimal"
                    ? "bg-gradient-to-r from-indigo-500 to-emerald-400"
                    : sleepEval.status === "fair"
                    ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                    : "bg-gradient-to-r from-rose-600 to-orange-500"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <p className="text-[11px] text-slate-300 flex items-center gap-1.5 pt-0.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>{sleepEval.advice}</span>
            </p>
          </div>

          {/* Sleep Quality Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-200 font-medium">คุณภาพการนอนหลับ</Label>
            <div className="grid grid-cols-2 gap-2">
              {QUALITY_OPTIONS.map((q) => (
                <button
                  key={q.value}
                  type="button"
                  onClick={() => setQuality(q.value)}
                  className={`py-2 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all ${
                    quality === q.value
                      ? "bg-indigo-600/30 border-indigo-400 text-white font-semibold shadow-sm"
                      : "bg-[#0b0f19] border-[#26334d] text-slate-400 hover:text-white"
                  }`}
                >
                  <span className="text-base">{q.emoji}</span>
                  <span>{q.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Daily Sleep Goal */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0b0f19] border border-[#26334d] text-xs">
            <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
              <Target className="h-3.5 w-3.5 text-indigo-400" />
              เป้าหมายเวลานอนต่อวัน:
            </span>
            <div className="flex items-center gap-1">
              {[6.5, 7, 7.5, 8, 8.5, 9].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setSleepGoalHours(g)
                    saveSleepGoal(person, g)
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded font-mono transition-all ${
                    sleepGoalHours === g
                      ? "bg-indigo-500 text-white font-bold shadow-sm"
                      : "text-slate-400 hover:text-white bg-[#111726] border border-[#26334d]/60"
                  }`}
                >
                  {g}ชม.
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-200 font-medium">บันทึกเพิ่มเติม (ไม่บังคับ)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เช่น ตื่นกลางดึก 1 ครั้ง, หลับสบายมาก, นอนดึกเพราะดูหนัง..."
              className="bg-[#0b0f19] border-[#26334d] text-white text-xs h-9"
            />
          </div>

          <DialogFooter className="pt-2 border-t border-[#26334d]">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[#26334d] text-slate-300 hover:text-white text-xs"
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 shadow-md shadow-indigo-950"
            >
              {saving ? "กำลังบันทึก..." : "+ บันทึกเวลานอน"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
