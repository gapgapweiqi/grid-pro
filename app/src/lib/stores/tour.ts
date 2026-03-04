import { writable, derived, get } from 'svelte/store';
import { goto } from '$app/navigation';
import { TOURS, TOUR_SEQUENCE, getNextTourId, getTourIndex, TOTAL_TOURS } from '$lib/config/tour-steps';
import type { TourStep } from '$lib/config/tour-steps';

const STORAGE_KEY = 'griddoc_completed_tours';
const PENDING_KEY = 'griddoc_pending_tour';

function loadCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveCompleted(set: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

interface PendingTour {
  tourId: string;
  step: number;
  seamless: boolean;
}

function savePending(pending: PendingTour | null) {
  if (pending) {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } else {
    sessionStorage.removeItem(PENDING_KEY);
  }
}

function loadPending(): PendingTour | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Which tour is currently active (null = none) */
export const activeTourId = writable<string | null>(null);

/** Current step index within the active tour */
export const activeTourStep = writable<number>(0);

/** Whether we're in seamless (full) tour mode — going page to page */
export const isSeamlessTour = writable<boolean>(false);

/** Whether a cross-page navigation is happening (show loading state) */
export const isNavigating = writable<boolean>(false);

/** Derived: current tour config */
export const activeTourConfig = derived(activeTourId, ($id) =>
  $id ? TOURS[$id] ?? null : null
);

/** Derived: current step data */
export const activeStepData = derived(
  [activeTourConfig, activeTourStep],
  ([$config, $step]) => $config?.steps[$step] ?? null
);

/** Derived: global progress for seamless tour (which page out of total) */
export const globalProgress = derived(
  [activeTourId, isSeamlessTour],
  ([$id, $seamless]) => {
    if (!$id || !$seamless) return null;
    return { current: getTourIndex($id), total: TOTAL_TOURS };
  }
);

/** Start a tour if user hasn't completed it yet */
export function startTourIfNew(tourId: string) {
  const completed = loadCompleted();
  if (completed.has(tourId)) return;
  activeTourId.set(tourId);
  activeTourStep.set(0);
}

/** Force-start a single-page tour regardless of completion status */
export function startTour(tourId: string) {
  const completed = loadCompleted();
  completed.delete(tourId);
  saveCompleted(completed);
  isSeamlessTour.set(false);
  activeTourId.set(tourId);
  activeTourStep.set(0);
  savePending(null);
}

/** Start the full seamless tour from the beginning (dashboard) */
export function startFullTour() {
  const firstId = TOUR_SEQUENCE[0];
  const completed = loadCompleted();
  for (const id of TOUR_SEQUENCE) completed.delete(id);
  saveCompleted(completed);
  isSeamlessTour.set(true);
  activeTourId.set(firstId);
  activeTourStep.set(0);
  const firstTour = TOURS[firstId];
  if (firstTour && window.location.pathname !== firstTour.path) {
    isNavigating.set(true);
    savePending({ tourId: firstId, step: 0, seamless: true });
    goto(firstTour.path).then(() => {
      isNavigating.set(false);
    });
  }
}

/** Advance to next step; handles cross-page navigation */
export async function nextStep(totalSteps: number) {
  const current = get(activeTourStep);
  const tourId = get(activeTourId);
  const seamless = get(isSeamlessTour);

  if (current < totalSteps - 1) {
    const nextIdx = current + 1;
    const tour = tourId ? TOURS[tourId] : null;
    const nextStepData: TourStep | undefined = tour?.steps[nextIdx];

    if (nextStepData?.navigateTo && window.location.pathname !== nextStepData.navigateTo) {
      isNavigating.set(true);
      savePending({ tourId: tourId!, step: nextIdx, seamless });
      await goto(nextStepData.navigateTo);
      isNavigating.set(false);
    } else {
      activeTourStep.set(nextIdx);
    }
  } else {
    // Last step of current tour
    if (seamless) {
      const nextTourId = getNextTourId(tourId!);
      if (nextTourId) {
        // Move to next tour in sequence
        markTourDone(tourId!);
        const nextTour = TOURS[nextTourId];
        const targetPath = nextTour?.steps[0]?.navigateTo || nextTour?.path;

        activeTourId.set(nextTourId);
        activeTourStep.set(0);

        if (targetPath && window.location.pathname !== targetPath) {
          isNavigating.set(true);
          savePending({ tourId: nextTourId, step: 0, seamless: true });
          await goto(targetPath);
          isNavigating.set(false);
        }
      } else {
        // End of entire seamless tour
        completeTour();
      }
    } else {
      completeTour();
    }
  }
}

/** Go back one step */
export function prevStep() {
  const current = get(activeTourStep);
  if (current > 0) {
    activeTourStep.set(current - 1);
  }
}

/** Mark a single tour as done without closing the UI */
function markTourDone(tourId: string) {
  const completed = loadCompleted();
  completed.add(tourId);
  saveCompleted(completed);
}

/** Mark tour as completed and close */
export function completeTour() {
  const tourId = get(activeTourId);
  if (tourId) {
    markTourDone(tourId);
  }
  activeTourId.set(null);
  activeTourStep.set(0);
  isSeamlessTour.set(false);
  savePending(null);
}

/** Skip (dismiss) the tour = same as complete */
export function skipTour() {
  completeTour();
}

/** Check if a tour has been completed */
export function isTourCompleted(tourId: string): boolean {
  return loadCompleted().has(tourId);
}

/** Reset all tours (for testing / settings) */
export function resetAllTours() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(PENDING_KEY);
  activeTourId.set(null);
  activeTourStep.set(0);
  isSeamlessTour.set(false);
}

/** Resume a pending tour after page navigation (called from layout) */
export function resumePendingTour() {
  const pending = loadPending();
  if (!pending) return;
  savePending(null);

  // Small delay to let the page render and elements appear
  setTimeout(() => {
    activeTourId.set(pending.tourId);
    activeTourStep.set(pending.step);
    isSeamlessTour.set(pending.seamless);
    isNavigating.set(false);
  }, 400);
}
