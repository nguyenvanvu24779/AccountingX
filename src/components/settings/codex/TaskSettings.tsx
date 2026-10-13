import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { type TaskCompleteBeepMode, type TaskDetail, useSettingsStore } from '@/stores/settings';

export function TaskSettings() {
  const { t } = useTranslation('settings');
  const {
    enableTaskCompleteBeep,
    setEnableTaskCompleteBeep,
    preventSleepDuringTasks,
    setPreventSleepDuringTasks,
    showReasoning,
    setShowReasoning,
    taskDetail,
    setTaskDetail,
  } = useSettingsStore();
  const handleTaskDetailChange = (value: string) => setTaskDetail(value as TaskDetail);
  const handleTaskCompleteBeepChange = (value: string) =>
    setEnableTaskCompleteBeep(value as TaskCompleteBeepMode);

  return (
    <div className="w-full px-2 sm:px-4 space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm sm:text-base font-medium">{t('taskSection.title')}</h3>
        <div className="flex flex-col gap-3 sm:gap-4 text-balance">
          <div className="flex items-center justify-between gap-3 rounded-md border p-3 sm:p-4">
            <div className="space-y-0.5">
              <p className="text-xs sm:text-sm font-medium">{t('taskSection.detail')}</p>
              <p className="text-xs text-muted-foreground">{t('taskSection.detailDescription')}</p>
            </div>
            <Select defaultValue={taskDetail} onValueChange={handleTaskDetailChange}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="steps">{t('taskSection.steps')}</SelectItem>
                <SelectItem value="stepsWithCommand">
                  {t('taskSection.stepsWithCommand')}
                </SelectItem>
                <SelectItem value="stepsWithOutput">{t('taskSection.stepsWithOutput')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-start justify-between gap-2 sm:gap-4 rounded-md border p-3 sm:p-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium">{t('taskSection.completionBeep')}</p>
              <p className="text-xs text-muted-foreground">
                {t('taskSection.completionBeepDescription')}
              </p>
            </div>
            <Select value={enableTaskCompleteBeep} onValueChange={handleTaskCompleteBeepChange}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">{t('taskSection.beepNever')}</SelectItem>
                <SelectItem value="unfocused">{t('taskSection.beepUnfocused')}</SelectItem>
                <SelectItem value="always">{t('taskSection.beepAlways')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-start justify-between gap-2 sm:gap-4 rounded-md border p-3 sm:p-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium">{t('taskSection.keepAwake')}</p>
              <p className="text-xs text-muted-foreground">
                {t('taskSection.keepAwakeDescription')}
              </p>
            </div>
            <Switch
              checked={preventSleepDuringTasks}
              onCheckedChange={setPreventSleepDuringTasks}
              className="flex-shrink-0"
            />
          </div>
          <div className="flex items-start justify-between gap-2 sm:gap-4 rounded-md border p-3 sm:p-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium">{t('taskSection.showReasoning')}</p>
              <p className="text-xs text-muted-foreground">
                {t('taskSection.showReasoningDescription')}
              </p>
            </div>
            <Switch
              checked={showReasoning}
              onCheckedChange={setShowReasoning}
              className="flex-shrink-0"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
