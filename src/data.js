import { makeIndex } from "./lib/utils.js";
import { sortCollection } from "./lib/sort.js";

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

    
    let sellers;
    let customers;
    let lastResult;
    let lastQuery;

    const mapRecords = (data) => data.map(item => ({
        id: item.receipt_id,
        date: item.date,
        seller: sellers[item.seller_id],
        customer: customers[item.customer_id],
        total: item.total_amount
    }));

    const getIndexes = async () => {
        if (!sellers || !customers) {
            try {
                [sellers, customers] = await Promise.all([
                    fetch(`${BASE_URL}/sellers`).then(res => res.json()),
                    fetch(`${BASE_URL}/customers`).then(res => res.json()),
                ]);
            } catch (e) {
                console.warn('Failed to fetch indexes, using local data', e);
                sellers = localSellers;
                customers = localCustomers;
            }
        }
        return { sellers, customers };
    };

    const isEmpty = (value) => value === undefined || value === null || value === '';

    const applyLocalSearch = (items, searchTerm) => {
        if (isEmpty(searchTerm)) return items;
        const term = String(searchTerm).toLowerCase();
        return items.filter(item =>
            ['date', 'customer', 'seller'].some(field => {
                const val = item[field];
                return typeof val === 'string' && val.toLowerCase().includes(term);
            })
        );
    };

    const applyLocalFilters = (items, filterObj) => {
        let filtered = [...items];
        if (filterObj.date) {
            const v = String(filterObj.date).toLowerCase();
            filtered = filtered.filter(item => item.date.toLowerCase().includes(v));
        }
        if (filterObj.customer) {
            const v = String(filterObj.customer).toLowerCase();
            filtered = filtered.filter(item => item.customer.toLowerCase().includes(v));
        }
        if (filterObj.seller) {
            filtered = filtered.filter(item => item.seller === filterObj.seller);
        }
        if (filterObj.totalFrom) {
            const from = Number(filterObj.totalFrom);
            if (!isNaN(from)) filtered = filtered.filter(item => item.total >= from);
        }
        if (filterObj.totalTo) {
            const to = Number(filterObj.totalTo);
            if (!isNaN(to)) filtered = filtered.filter(item => item.total <= to);
        }
        return filtered;
    };

    const applyLocalSort = (items, sortStr) => {
        if (!sortStr) return items;
        const [field, order] = sortStr.split(':');
        if (!field || !order) return items;
        return sortCollection(items, field, order);
    };

    const applyLocalPagination = (items, page, limit) => {
        const total = items.length;
        const start = (page - 1) * limit;
        const pagedItems = items.slice(start, start + limit);
        return { total, items: pagedItems };
    };

    const getRecords = async (query, isUpdated = false) => {
        const qs = new URLSearchParams(query);
        const nextQuery = qs.toString();

        if (lastQuery === nextQuery && !isUpdated) {
            return lastResult;
        }

        try {
            const response = await fetch(`${BASE_URL}/records?${nextQuery}`);
            const records = await response.json();

            lastQuery = nextQuery;
            lastResult = {
                total: records.total,
                items: mapRecords(records.items)
            };
        } catch (e) {
            console.warn('Failed to fetch records, using local data', e);
           
            const search = query.search;
            const sort = query.sort;
            const page = parseInt(query.page) || 1;
            const limit = parseInt(query.limit) || 10;
            // Собираем объект фильтра из ключей filter[...]
            const filter = {};
            Object.keys(query).forEach(key => {
                const match = key.match(/^filter\[(.+)\]$/);
                if (match) {
                    filter[match[1]] = query[key];
                }
            });

            let items = [...localData];
            items = applyLocalSearch(items, search);
            items = applyLocalFilters(items, filter);
            items = applyLocalSort(items, sort);
            const paginated = applyLocalPagination(items, page, limit);

            lastResult = {
                total: paginated.total,
                items: paginated.items
            };
        }

        return lastResult;
    };

    return {
        getIndexes,
        getRecords
    };
}