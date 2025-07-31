export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];
  
  // 8文字以上
  if (password.length < 8) {
    errors.push('パスワードは8文字以上である必要があります');
  }
  
  // 大文字を含む
  if (!/[A-Z]/.test(password)) {
    errors.push('大文字を1文字以上含む必要があります');
  }
  
  // 小文字を含む
  if (!/[a-z]/.test(password)) {
    errors.push('小文字を1文字以上含む必要があります');
  }
  
  // 数字を含む
  if (!/[0-9]/.test(password)) {
    errors.push('数字を1文字以上含む必要があります');
  }
  
  // 特殊文字を含む（オプション - より強固にする場合）
  // if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
  //   errors.push('特殊文字を1文字以上含む必要があります');
  // }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}