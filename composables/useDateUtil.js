/**
 * @file useDateUtil.js
 * @description Composable for date utility functions.
 */
import dayjs from "dayjs";

/**
 * Date utility composable
 */
export function useDateUtil() {
  /**
   * Validates and processes date range parameters.
   * @param {Date|string} from - Start date
   * @param {Date|string|number} to - End date or number of days from 'from' date
   * @returns {Object|null} Object with fromDate and toDate (dayjs objects) or null if invalid
   */
  const validateAndProcessDateRange = (from, to) => {
    if (!from) {
      console.error("Start date (from) is required.");
      return null;
    }

    if (to === undefined || to === null) {
      console.error("End date or days (to) is required.");
      return null;
    }

    const fromDate = dayjs(from);
    if (!fromDate.isValid()) {
      console.error("Invalid start date provided.");
      return null;
    }

    let toDate;
    if (typeof to === "number") {
      if (to < 0) {
        console.error("Number of days must be positive.");
        return null;
      }
      toDate = fromDate.add(to, "day");
    } else {
      toDate = dayjs(to);
      if (!toDate.isValid()) {
        console.error("Invalid end date provided.");
        return null;
      }
    }

    if (toDate.isBefore(fromDate)) {
      console.error("End date must be after start date.");
      return null;
    }

    return { fromDate, toDate };
  };

  /**
   * Simple date range validation (returns boolean)
   * @param {Date|string} from - Start date
   * @param {Date|string} to - End date
   * @returns {boolean} True if valid, false otherwise
   */
  const validateDateRange = (from, to) => {
    if (!from || !to) {
      console.error("Both 'from' and 'to' dates are required.");
      return false;
    }

    const fromDate = dayjs(from);
    const toDate = dayjs(to);

    if (!fromDate.isValid() || !toDate.isValid()) {
      console.error("Invalid date provided for 'from' or 'to'.");
      return false;
    }

    if (toDate.isBefore(fromDate)) {
      console.error("'To' date must be after 'from' date.");
      return false;
    }

    return true;
  };

  /**
   * Format date to a specific format
   * @param {Date|string} date - Date to format
   * @param {string} format - Format string (default: 'YYYY-MM-DD')
   * @returns {string|null} Formatted date string or null if invalid
   */
  const formatDate = (date, format = "YYYY-MM-DD") => {
    const dayjsDate = dayjs(date);
    if (!dayjsDate.isValid()) {
      console.error("Invalid date provided for formatting.");
      return null;
    }
    return dayjsDate.format(format);
  };

  /**
   * Check if a date is valid
   * @param {Date|string} date - Date to validate
   * @returns {boolean} True if valid, false otherwise
   */
  const isValidDate = (date) => {
    return dayjs(date).isValid();
  };

  return {
    validateAndProcessDateRange,
    validateDateRange,
    formatDate,
    isValidDate,
  };
}
