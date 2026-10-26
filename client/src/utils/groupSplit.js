export const getGroupSplitReason = (group) => {
  if (Number(group?.IsUsable) === 1) return '';
  return group?.UnusableReason
    ? `Split unavailable because ${group.UnusableReason}`
    : 'Split unavailable: the Life Group and both parent structures must exist and be active.';
};

export const getHierarchySplitReason = (entity) => Number(entity?.IsUsable) === 1 ? '' : entity?.UnusableReason ? `Split unavailable because ${entity.UnusableReason}` : 'Split unavailable: this structure and its required parents must be active.';
