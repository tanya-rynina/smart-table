import { makeIndex } from "./lib/utils.js";
import { sortCollection } from "./lib/sort.js";
import { createComparison, defaultRules, rules } from "./lib/compare.js";

const BASE_URL = '/sp7-api';

export function initData(sourceData) {
   
    const localSellers = makeIndex(sourceData.sellers, 'id', v => `${v.first_name} ${v.last_name}`);
    const localCustomers = makeIndex(sourceData.customers, 'id', v => `${v.first_name} ${v.last_name}`);
    const localData = sourceData.purchase_records.map(item => ({
        id: item.receipt_id,
        date: item.date,
        seller: localSellers[item.seller_id],
        customer: localCustomers[item.customer_id],
        total: item.total_amount
    }));

    
    const compare = createComparison(defaultRules);
    const searchCompare = createComparison(
        ['skipEmptyTargetValues'],
        [rules.searchMultipleFields('search', ['date', 'customer', 'seller'], false)]
    );

    const isEmpty = value => value === undefined || value === null || value === '';

    
    let sellers = null;
    let customers = null;

    const getIndexes = async () => {
        if (!sellers || !customers) {
            try {
                const [sellersData, customersData] = await Promise.all([
                    fetch(`${BASE_URL}/sellers`).then(res => res.json()),
                    fetch(`${BASE_URL}/customers`).then(res => res.json()),
                ]);
                sellers = sellersData;
                customers = customersData;
            } catch {
               
                sellers = localSellers;
                customers = localCustomers;
            }
        }
        return { sellers, customers };
    };

    const mapRecords = (data) => data.map(item => ({
        id: item.receipt_id,
        date: item.date,
        seller: sellers[item.seller_id],
        customer: customers[item.customer_id],
        total: item.total_amount
    }));

    const getRecords = async (query) => {
        const qs = new URLSearchParams(query).toString();

       
        try {
            const response = await fetch(`${BASE_URL}/records?${qs}`);
            const records = await response.json();
            return {
                total: records.total,
                items: mapRecords(records.items)
            };
        } catch {
        
            let items = [...localData];

           
            if (query.search) {
                const searchState = { search: query.search };
                items = items.filter(item => searchCompare(item, searchState));
            }

           
            const filterState = {};
            Object.keys(query).forEach(key => {
                const match = key.match(/^filter\[(.+)\]$/);
                if (match) {
                    filterState[match[1]] = query[key];
                }
            });
           
            const hasFrom = !isEmpty(filterState.totalFrom);
            const hasTo = !isEmpty(filterState.totalTo);
            if (hasFrom || hasTo) {
                const from = hasFrom ? Number(filterState.totalFrom) : undefined;
                const to = hasTo ? Number(filterState.totalTo) : undefined;
                filterState.total = [from, to];
            }
            delete filterState.totalFrom;
            delete filterState.totalTo;

            if (Object.keys(filterState).length > 0) {
                items = items.filter(item => compare(item, filterState));
            }

           
            if (query.sort) {
                const [field, order] = query.sort.split(':');
                if (field && order && order !== 'none') {
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

            return { total, items: pagedItems };
        }
    };

    return { getIndexes, getRecords };
}