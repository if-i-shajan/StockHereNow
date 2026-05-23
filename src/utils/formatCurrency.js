export const formatTaka = (amount) => {
    return "৳ " + Number(amount).toLocaleString("en-BD", { minimumFractionDigits: 2 });
};
