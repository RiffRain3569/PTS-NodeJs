export const unitFloor = (price: number): number => {
    let floorLimit = Math.pow(10, price < 1 ? 4 : price < 10 ? 3 : price < 100 ? 2 : 0);

    return Math.floor(price * floorLimit) / floorLimit;
};
