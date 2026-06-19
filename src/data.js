import { makeIndex } from "./lib/utils.js";
import { sortCollection } from "./lib/sort.js";
import { createComparison, defaultRules, rules } from "./lib/compare.js";

export function initData(sourceData) {
  const localSellers = makeIndex(
    sourceData.sellers,
    "id",
    (v) => `${v.first_name} ${v.last_name}`,
  );
  const localCustomers = makeIndex(
    sourceData.customers,
    "id",
    (v) => `${v.first_name} ${v.last_name}`,
  );
  const localData = sourceData.purchase_records.map((item) => ({
    id: item.receipt_id,
    date: item.date,
    seller: localSellers[item.seller_id],
    customer: localCustomers[item.customer_id],
    total: item.total_amount,
  }));

  const compare = createComparison(defaultRules);
  const searchCompare = createComparison(
    ["skipEmptyTargetValues"],
    [
      rules.searchMultipleFields(
        "search",
        ["date", "customer", "seller"],
        false,
      ),
    ],
  );

  const isEmpty = (value) =>
    value === undefined || value === null || value === "";

  const getIndexes = async () => {
    return { sellers: localSellers, customers: localCustomers };
  };

  const getRecords = async (query) => {
    let items = [...localData];

    if (query.search) {
      const searchState = { search: query.search };
      items = items.filter((item) => searchCompare(item, searchState));
    }

    const filterState = {};
    Object.keys(query).forEach((key) => {
      const match = key.match(/^filter\[(.+)\]$/);
      if (match) {
        filterState[match[1]] = query[key];
      }
    });

    const hasTotalFrom = !isEmpty(filterState.totalFrom);
    const hasTotalTo = !isEmpty(filterState.totalTo);
    if (hasTotalFrom || hasTotalTo) {
      const from = hasTotalFrom ? Number(filterState.totalFrom) : undefined;
      const to = hasTotalTo ? Number(filterState.totalTo) : undefined;
      filterState.total = [from, to];
    }
    delete filterState.totalFrom;
    delete filterState.totalTo;

    if (Object.keys(filterState).length > 0) {
      items = items.filter((item) => compare(item, filterState));
    }

    if (query.sort) {
      const [field, order] = query.sort.split(":");
      if (field && order && order !== "none") {
        items = sortCollection(items, field, order);
      }
    }

    const total = items.length;
    const limit = parseInt(query.limit) || 10;
    let page = parseInt(query.page) || 1;
    const pageCount = Math.ceil(total / limit);

    page = Math.max(1, Math.min(page, pageCount));
    const start = (page - 1) * limit;
    const pagedItems = items.slice(start, start + limit);

    return {
      total,
      items: pagedItems,
    };
  };

  return { getIndexes, getRecords };
}
