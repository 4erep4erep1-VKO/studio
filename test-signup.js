// Тестовый скрипт для проверки регистрации
// Запустите в браузере: node test-signup.js

import { signUp } from './src/lib/auth.js';

async function testSignUp() {
  try {
    console.log('🧪 Testing signUp function...');

    const result = await signUp(
      'test@example.com',
      'password123',
      'Тестовый Пользователь',
      'installer'
    );

    console.log('✅ Success:', result);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testSignUp();