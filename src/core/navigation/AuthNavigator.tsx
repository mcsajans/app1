import React, { useState } from 'react';

import LoginScreen from '../../screens/LoginScreen';
import RegisterScreen from '../../screens/RegisterScreen';

/**
 * Oturum açılmadan önceki iki ekran. React Navigation yığını yerine basit bir
 * durum anahtarı kullanılır: geçiş tek yönlü ve geri tuşuyla çıkılacak bir
 * ekran yok (TEKNIK_DOKUMAN.md §5.7).
 */
export function AuthNavigator() {
  const [screen, setScreen] = useState<'login' | 'register'>('login');

  return screen === 'login' ? (
    <LoginScreen onGoRegister={() => setScreen('register')} />
  ) : (
    <RegisterScreen onGoLogin={() => setScreen('login')} />
  );
}
