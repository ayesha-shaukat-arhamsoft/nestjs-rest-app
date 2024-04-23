export const getBase64Url = (base64UrlEncodedString = '') => {
  if (base64UrlEncodedString)
    return `data:image/jpeg;base64,${base64UrlEncodedString}`;
};
