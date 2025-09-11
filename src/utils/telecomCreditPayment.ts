/**
 * Telecom Credit決済への遷移処理
 */

export interface TelecomCreditPaymentData {
  planId: '1month' | '3month' | '6month' | '12month';
  userId: string;
  userEmail: string;
  userName?: string;
}

const PLAN_PRICES: Record<string, number> = {
  '1month': 1980,
  '3month': 4650,
  '6month': 8100,
  '12month': 13800
};

/**
 * Telecom Credit決済画面へ遷移する
 * フォームを動的に作成してPOST送信
 */
export function redirectToTelecomCredit(data: TelecomCreditPaymentData): void {
  const { planId, userId, userEmail, userName } = data;
  const price = PLAN_PRICES[planId];

  if (!price) {
    console.error('Invalid plan ID:', planId);
    throw new Error(`Invalid plan ID: ${planId}`);
  }


  // 既存のフォームがあれば削除
  const existingForm = document.getElementById('telecom-credit-form');
  if (existingForm) {
    existingForm.remove();
  }

  // フォームを動的に作成
  const form = document.createElement('form');
  form.id = 'telecom-credit-form';
  form.method = 'POST';
  form.action = 'https://secure.telecomcredit.co.jp/inetcredit/secure/order.pl';
  
  // 重要: targetを_selfに設定して現在のウィンドウで遷移
  form.target = '_self';
  
  // フォームを表示せずに送信
  form.style.position = 'absolute';
  form.style.left = '-9999px';
  form.style.top = '-9999px';
  
  // エンコーディングを明示的に設定
  form.acceptCharset = 'UTF-8';

  // 必須パラメータ
  const params = [
    { name: 'clientip', value: '60146' },
    { name: 'sendid', value: userId },
    { name: 'money', value: price.toString() },
    { name: 'usrmail', value: userEmail },
  ];

  // オプションパラメータ
  if (userName && userName.trim() !== '') {
    params.push({ name: 'username', value: userName });
  }
  params.push({ name: 'option', value: planId });

  // インプット要素を作成して追加
  params.forEach(param => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = param.name;
    input.value = param.value;
    form.appendChild(input);
  });

  // ドキュメントの最初の要素として追加（bodyの最初に配置）
  if (document.body.firstChild) {
    document.body.insertBefore(form, document.body.firstChild);
  } else {
    document.body.appendChild(form);
  }

  // Reactのイベントループから外れて実行
  // requestAnimationFrameを使ってブラウザの次の描画フレームで実行
  requestAnimationFrame(() => {
    // さらにsetTimeoutで非同期実行を確実にする
    setTimeout(() => {
      try {
        // フォームがまだDOMに存在することを確認
        const formElement = document.getElementById('telecom-credit-form') as HTMLFormElement;
        if (!formElement) {
          console.error('Form not found in DOM');
          throw new Error('Form element not found');
        }

        // HTMLFormElementのsubmitメソッドを直接呼び出す
        // これによりイベントハンドラーをバイパスして直接送信
        HTMLFormElement.prototype.submit.call(formElement);
        
      } catch (error) {
        console.error('Failed to submit payment form:', error);
        
        // エラーが発生した場合は、フォームを削除
        const errorForm = document.getElementById('telecom-credit-form');
        if (errorForm) {
          errorForm.remove();
        }
        
        throw error;
      }
    }, 0);
  });
}