export const kstToUtcTimestamp = (time: string | number | Date): string => {
    if (!time) {
        throw new Error('Time is required');
    }

    if (time instanceof Date) {
        return time.getTime().toString();
    }

    if (typeof time === 'number') {
        return time.toString();
    }

    // If it's a string, check if it's already a number string
    if (!isNaN(Number(time))) {
        return time;
    }

    // Should be a date string
    // Assuming KST input if it's a string like 'YYYY-MM-DD HH:mm:ss'
    // If we want to support 'YYYY-MM-DDTHH:mm:ss', new Date() handles it as local or UTC depending on format.
    // Ideally, for KST explicit support, we might want to append offset if missing.
    // However, simplest way for 'YYYY-MM-DD HH:mm:ss' to be treated as KST (UTC+9)
    // is to replace ' ' with 'T' and append '+09:00'

    let dateStr = time.trim();

    // Check if it matches YYYY-MM-DD HH:mm:ss format approximately
    const simpleFormatRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    if (simpleFormatRegex.test(dateStr)) {
        dateStr = dateStr.replace(' ', 'T') + '+09:00';
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format: ${time}`);
    }

    return date.getTime().toString();
};
