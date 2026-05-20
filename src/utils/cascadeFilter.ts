/**
 * 階層篩選下拉的選項過濾器
 *
 * 適用情境:篩選器同時有「結構階層」(如部門→業務別)與「資料 facets」
 * (後端依 RBAC 可見範圍計算的實際出現集)兩種來源,
 * 想要「選了上層 → 下拉只列該層下的子項」+「沒資料的子項不顯示」。
 *
 * 設計取捨見 docs/adr/0005-notification-error-contract.md 同議題討論。
 *
 * @example 知識庫部門→業務別篩選
 *   const options = intersectByFacet(
 *     deptId ? deptBts.map(b => b.id) : facets.businessTypeIds,
 *     facets.businessTypeIds,
 *   )
 */
export function intersectByFacet(
  candidates: readonly string[],
  facetIds: readonly string[]
): string[] {
  if (candidates === facetIds) return [...candidates];
  const facetSet = new Set(facetIds);
  return candidates.filter((id) => facetSet.has(id));
}
