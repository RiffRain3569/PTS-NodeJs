export const unitFloor = (price: number): number => {
    return price < 1
        ? Math.floor(price * 100000) / 100000 // 0.00001 단위
        : price < 10
        ? Math.floor(price * 1000) / 1000 // 0.001 단위
        : price < 100
        ? Math.floor(price * 100) / 100 // 0.01 단위
        : price < 5000
        ? Math.floor(price) // 1 단위
        : price < 10000
        ? Math.floor(price) - (Math.floor(price) % 5) // 5 단위
        : price < 50000
        ? Math.floor(price) - (Math.floor(price) % 10) // 10 단위
        : price < 100000
        ? Math.floor(price) - (Math.floor(price) % 50) // 50 단위
        : price < 500000
        ? Math.floor(price) - (Math.floor(price) % 100) // 100 단위
        : price < 1000000
        ? Math.floor(price) - (Math.floor(price) % 500) // 100 단위
        : Math.floor(price) - (Math.floor(price) % 1000); // 1000 단위
};
