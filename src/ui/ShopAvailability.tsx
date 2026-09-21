import type { ShopJudgement } from '../core';

/**
 * 门店结论展示：建筑可进入与服务可交易分开呈现，互不推导。
 * 颜色代表证据强度：绿色确认可用、红色确认关闭、黄色暂按不可用。
 * 条件性交易窗口只作非阻断技巧提示。
 */
export function ShopAvailabilityList({ judgement }: { judgement: ShopJudgement }) {
  return (
    <span className="shop-availability" data-testid="shop-availability">
      <Verdict
        testId="shop-access"
        dimension="建筑可进入"
        verdict={judgement.access}
      />
      <Verdict
        testId="shop-service"
        dimension="服务可交易"
        verdict={judgement.service}
      />
      {judgement.tips.map((tip) => (
        <span className="verdict tips" key={`${tip.ruleId}:${tip.approximateTime}`} data-testid="shop-tip">
          技巧：{tip.text}
        </span>
      ))}
    </span>
  );
}

function Verdict({
  testId,
  dimension,
  verdict,
}: {
  testId: string;
  dimension: string;
  verdict: ShopJudgement['access'];
}) {
  const detail = verdict.state === 'available' ? verdict.hours : verdict.reason;
  return (
    <span className={`verdict ${verdict.tone}`} data-testid={testId}>
      {dimension}：{verdict.label}
      {detail ? `（${detail}）` : ''}
    </span>
  );
}
