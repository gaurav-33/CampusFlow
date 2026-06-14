import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'campusflow_jwt';
const STUDENT_KEY = 'campusflow_student';

export const saveToken = (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token);
export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const removeToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);

export const saveStudent = (s: { studentId: string; name: string }) =>
  SecureStore.setItemAsync(STUDENT_KEY, JSON.stringify(s));

export const getStudent = async (): Promise<{ studentId: string; name: string } | null> => {
  const raw = await SecureStore.getItemAsync(STUDENT_KEY);
  return raw ? JSON.parse(raw) : null;
};

export const clearStorage = async () => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(STUDENT_KEY);
};
