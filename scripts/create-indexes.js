/**
 * Firestore複合インデックス作成用スクリプト
 * 
 * 注意: 複合インデックスはFirebase Admin SDKでは作成できないため、
 * Firebase ConsoleまたはFirebase CLIを使用する必要があります。
 * 
 * このファイルは、必要なインデックスの設定を記録するためのものです。
 */

const requiredIndexes = [
  {
    collectionGroup: 'posts',
    queryScope: 'COLLECTION',
    fields: [
      {
        fieldPath: 'communityId',
        order: 'ASCENDING'
      },
      {
        fieldPath: 'timestamp',
        order: 'DESCENDING'
      }
    ]
  },
  {
    collectionGroup: 'communities',
    queryScope: 'COLLECTION',
    fields: [
      {
        fieldPath: 'memberCount',
        order: 'DESCENDING'
      }
    ]
  }
];

console.log('必要なFirestoreインデックス:');
console.log(JSON.stringify(requiredIndexes, null, 2));

console.log('\n以下のコマンドでFirebase CLIを使用してインデックスを作成できます:');
console.log('firebase deploy --only firestore:indexes');

console.log('\nまたは、エラーメッセージに表示されたリンクをクリックして、');
console.log('Firebase Consoleで直接作成することもできます。');