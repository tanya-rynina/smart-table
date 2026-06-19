import { makeIndex } from "./lib/utils.js";

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
            lastResult = {
                total: localData.length,
                items: localData
            };
        }

        return lastResult;
    };

    return {
        getIndexes,
        getRecords
    };
}