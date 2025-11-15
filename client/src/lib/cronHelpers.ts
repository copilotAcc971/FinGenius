export type FrequencyPreset = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';

export interface ScheduleConfig {
  frequency: FrequencyPreset;
  time: string; // HH:mm format
  dayOfWeek?: number; // 0-6 (Sunday-Saturday) for weekly
  dayOfMonth?: number; // 1-31 for monthly
  customCron?: string; // for custom frequency
}

export function frequencyToCron(config: ScheduleConfig): string {
  if (config.frequency === 'custom') {
    return config.customCron || '0 9 * * *';
  }

  const [hours, minutes] = config.time.split(':').map(Number);

  switch (config.frequency) {
    case 'daily':
      // Every day at specified time
      return `${minutes} ${hours} * * *`;

    case 'weekly':
      // Every week on specified day at specified time
      const dayOfWeek = config.dayOfWeek ?? 1; // Default to Monday
      return `${minutes} ${hours} * * ${dayOfWeek}`;

    case 'monthly':
      // Every month on specified day at specified time
      const dayOfMonth = config.dayOfMonth ?? 1; // Default to 1st
      return `${minutes} ${hours} ${dayOfMonth} * *`;

    case 'quarterly':
      // Every quarter (1st day of Jan, Apr, Jul, Oct) at specified time
      const quarterlyDay = config.dayOfMonth ?? 1;
      return `${minutes} ${hours} ${quarterlyDay} 1,4,7,10 *`;

    default:
      return `0 9 * * *`; // Default to daily at 9am
  }
}

export function cronToReadable(cron: string): string {
  try {
    const parts = cron.trim().split(' ');
    if (parts.length < 5) {
      return 'Invalid cron expression';
    }

    const [minutes, hours, dayOfMonth, month, dayOfWeek] = parts;

    // Parse time
    const timeStr = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;

    // Daily: * * * (any day, any month, any day of week)
    if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return `Daily at ${timeStr}`;
    }

    // Weekly: * * N (specific day of week)
    if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayNum = parseInt(dayOfWeek);
      const dayName = dayNames[dayNum] || dayOfWeek;
      return `Every ${dayName} at ${timeStr}`;
    }

    // Monthly: N * * (specific day of month)
    if (dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
      const day = parseInt(dayOfMonth);
      const suffix = getDaySuffix(day);
      return `Monthly on the ${day}${suffix} at ${timeStr}`;
    }

    // Quarterly: N 1,4,7,10 *
    if (dayOfMonth !== '*' && month === '1,4,7,10' && dayOfWeek === '*') {
      const day = parseInt(dayOfMonth);
      const suffix = getDaySuffix(day);
      return `Quarterly on the ${day}${suffix} at ${timeStr}`;
    }

    // Custom/complex pattern
    return `Custom: ${cron}`;
  } catch (error) {
    return `Invalid: ${cron}`;
  }
}

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) {
    return 'th';
  }
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

export function parseFrequencyFromCron(cron: string): ScheduleConfig | null {
  try {
    const parts = cron.trim().split(' ');
    if (parts.length < 5) {
      return null;
    }

    const [minutes, hours, dayOfMonth, month, dayOfWeek] = parts;
    const time = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;

    // Daily
    if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return { frequency: 'daily', time };
    }

    // Weekly
    if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
      return {
        frequency: 'weekly',
        time,
        dayOfWeek: parseInt(dayOfWeek)
      };
    }

    // Monthly
    if (dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
      return {
        frequency: 'monthly',
        time,
        dayOfMonth: parseInt(dayOfMonth)
      };
    }

    // Quarterly
    if (dayOfMonth !== '*' && month === '1,4,7,10' && dayOfWeek === '*') {
      return {
        frequency: 'quarterly',
        time,
        dayOfMonth: parseInt(dayOfMonth)
      };
    }

    // Custom
    return {
      frequency: 'custom',
      time,
      customCron: cron
    };
  } catch (error) {
    return null;
  }
}

export function validateCronExpression(cron: string): boolean {
  try {
    const parts = cron.trim().split(' ');
    if (parts.length !== 5) {
      return false;
    }

    const [minutes, hours, dayOfMonth, month, dayOfWeek] = parts;

    // Basic validation
    const isValidPart = (part: string, min: number, max: number): boolean => {
      if (part === '*') return true;
      if (part.includes(',')) {
        return part.split(',').every(p => isValidPart(p, min, max));
      }
      if (part.includes('/')) {
        const [, step] = part.split('/');
        return !isNaN(parseInt(step));
      }
      const num = parseInt(part);
      return !isNaN(num) && num >= min && num <= max;
    };

    return (
      isValidPart(minutes, 0, 59) &&
      isValidPart(hours, 0, 23) &&
      isValidPart(dayOfMonth, 1, 31) &&
      isValidPart(month, 1, 12) &&
      isValidPart(dayOfWeek, 0, 6)
    );
  } catch (error) {
    return false;
  }
}
