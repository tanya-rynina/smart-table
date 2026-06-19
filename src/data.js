const BASE_URL = '/sp7-api';

export function initData(sourceData) {
    let sellers;
    let customers;

    const mapRecords = (data) => data.map(item => ({
        id: item.receipt_id,
        date: item.date,
        seller: sellers[item.seller_id],
        customer: customers[item.customer_id],
        total: item.total_amount
    }));

    const getIndexes = async () => {
        if (!sellers || !customers) {
            const [sellersData, customersData] = await Promise.all([
                fetch(`${BASE_URL}/sellers`).then(res => res.json()),
                fetch(`${BASE_URL}/customers`).then(res => res.json()),
            ]);
            sellers = sellersData;
            customers = customersData;
        }
        return { sellers, customers };
    };

    const getRecords = async (query) => {
        const qs = new URLSearchParams(query);
        const response = await fetch(`${BASE_URL}/records?${qs.toString()}`);
        const records = await response.json();
        return {
            total: records.total,
            items: mapRecords(records.items)
        };
    };

    return { getIndexes, getRecords };
}