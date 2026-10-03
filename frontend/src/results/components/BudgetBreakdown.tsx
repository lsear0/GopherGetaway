import type { BudgetBreakdown as BudgetBreakdownModel } from '../../agent';
import { usd } from '../format';

interface BudgetBreakdownProps {
  budget: BudgetBreakdownModel;
}

/**
 * The budget breakdown. Each category shows its label, dollar amount, and percentage as
 * TEXT — the bar is a secondary, redundant cue. We also vary each bar's texture (via a
 * data attribute → CSS pattern) so categories are distinguishable without relying on
 * color, satisfying the "don't use color alone" requirement. A visually-hidden caption
 * and proper table semantics give screen-reader users the same information.
 */
export function BudgetBreakdown({ budget }: BudgetBreakdownProps) {
  return (
    <section className="budget" aria-labelledby="budget-heading">
      <div className="budget__header">
        <h2 id="budget-heading">Budget breakdown</h2>
        <p className="budget__total">
          <span className="budget__total-amount">{usd(budget.totalUsd)}</span>
          <span className="budget__total-label"> estimated total</span>
        </p>
      </div>

      <p className={`budget__status budget__status--${budget.withinBudget ? 'ok' : 'over'}`}>
        <span aria-hidden="true">{budget.withinBudget ? '✓ ' : '! '}</span>
        {budget.limitUsd == null
          ? 'No budget limit set — this is a balanced estimate.'
          : budget.withinBudget
            ? `Within your ${usd(budget.limitUsd)} budget.`
            : `About ${usd(budget.totalUsd - budget.limitUsd)} over your ${usd(
                budget.limitUsd,
              )} budget.`}
      </p>

      {/* Visual bars — redundant with the table below; marked decorative for SR users. */}
      <ul className="budget__bars" aria-hidden="true">
        {budget.categories.map((c, i) => (
          <li key={c.id} className="budget-bar" data-pattern={i % 5}>
            <div className="budget-bar__top">
              <span className="budget-bar__label">{c.label}</span>
              <span className="budget-bar__amount">
                {usd(c.amountUsd)} · {c.percent}%
              </span>
            </div>
            <div className="budget-bar__track">
              <div className="budget-bar__fill" style={{ width: `${c.percent}%` }} />
            </div>
          </li>
        ))}
      </ul>

      {/* Textual / tabular equivalent — the source of truth for assistive tech. */}
      <table className="budget__table">
        <caption className="visually-hidden">
          Estimated trip budget by category, with amount and percentage of the total.
        </caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Amount</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {budget.categories.map((c) => (
            <tr key={c.id}>
              <th scope="row">{c.label}</th>
              <td>{usd(c.amountUsd)}</td>
              <td>{c.percent}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td>{usd(budget.totalUsd)}</td>
            <td>100%</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
