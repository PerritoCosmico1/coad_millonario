/** Targets (antes). The prototype only has the liquor store. */
export const TARGETS = {
  liquorStore: {
    name: 'Liquor store',
    short: 'liquor store',
    text: 'A corner liquor store downtown. Small takings, a back-office safe, one bored clerk.',
  },
};

export type TargetId = keyof typeof TARGETS;
export const CURRENT_TARGET: TargetId = 'liquorStore';
