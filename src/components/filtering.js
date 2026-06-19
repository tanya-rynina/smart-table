import {createComparison, defaultRules} from "../lib/compare.js";

// @todo: #4.3 — настроить компаратор
const compare = createComparison(defaultRules);

// Проверяет, пустое ли значение (локальный аналог isEmpty из compare.js)
function isEmpty(value) {
    return value === undefined || value === null || value === '' || (typeof value === 'number' && isNaN(value));
}

export function initFiltering(elements, indexes) {
    // @todo: #4.1 — заполнить выпадающие списки опциями
    Object.keys(indexes)
        .forEach((elementName) => {
            elements[elementName].append(
                ...Object.values(indexes[elementName])
                    .map(name => {
                        const option = document.createElement('option');
                        option.value = name;
                        option.textContent = name;
                        return option;
                    })
            );
        });

    return (data, state, action) => {
        // @todo: #4.2 — обработать очистку поля
        if (action && action.name === 'clear') {
            const parent = action.parentElement;
            const input = parent.querySelector('input, select');
            if (input) {
                input.value = '';
                const field = action.dataset.field;
                if (field && state.hasOwnProperty(field)) {
                    state[field] = '';
                }
            }
        }

        // Собираем состояние для фильтрации с корректным диапазоном total
        const filterState = { ...state };

        // Проверяем, задано ли любое из полей диапазона
        const hasTotalFrom = !isEmpty(filterState.totalFrom) && filterState.totalFrom.trim() !== '';
        const hasTotalTo = !isEmpty(filterState.totalTo) && filterState.totalTo.trim() !== '';

        if (hasTotalFrom || hasTotalTo) {
            const from = hasTotalFrom ? Number(filterState.totalFrom) : undefined;
            const to = hasTotalTo ? Number(filterState.totalTo) : undefined;
            filterState.total = [from, to];
        }

        // Удаляем отдельные поля, чтобы не мешали сравнению
        delete filterState.totalFrom;
        delete filterState.totalTo;

        // @todo: #4.5 — отфильтровать данные используя компаратор
        return data.filter(row => compare(row, filterState));
    }
}