export const successRes = (resData: any = null) => {
    const resBody = { status: 'success', ...resData };
    return resBody;
};

export const failRes = (errMessage: string) => {
    const resBody = {
        status: 'fail',
        errMessage,
    };
    return resBody;
};
