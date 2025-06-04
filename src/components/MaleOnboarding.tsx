"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { type MalePreferences, defaultMalePreferences, saveMalePreferences, getMalePreferences } from '@/lib/firebase/malePreferences';
import { useToast } from '@/hooks/use-toast';

interface MaleOnboardingProps {
  userId: string;
  userEmail?: string;
  onComplete: () => void;
  onBack?: () => void;
}

const TOTAL_STEPS = 8;

export default function MaleOnboarding({ userId, userEmail, onComplete, onBack }: MaleOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [preferences, setPreferences] = useState<MalePreferences>({
    ...defaultMalePreferences,
    partnerAgeMax: 30, // 確実に30歳を初期値に設定
    isComplete: false
  } as MalePreferences);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingInitialData, setLoadingInitialData] = useState(true);
  const { toast } = useToast();

  // 既存の設定を読み込み
  useEffect(() => {
    const loadExistingPreferences = async () => {
      console.log('Loading preferences for user:', userId);
      try {
        const existingPreferences = await getMalePreferences(userId);
        console.log('Existing preferences:', existingPreferences);
        
        if (existingPreferences) {
          setPreferences(existingPreferences);
          console.log('Preferences loaded from Firebase');
        } else {
          // 新規ユーザーの場合、デフォルト値を確実に設定
          const defaultPrefs = {
            spanking: 3, outdoorPlay: 3, groupPlay: 3, throating: 3, bondage: 3,
            oralReceiving: 3, hypnosisPlay: 3, analPlay: 3, cosplay: 3, toyPlay: 3,
            verbalPlay: 3, squirting: 3, deepthroat: 3, partnerBodyTypes: [],
            experienceCount: '', recordingDuringPlay: '', isSadist: '', isMasochist: '',
            seekingType: '', partnerHeight: '', partnerWeight: '', partnerBodyType: '',
            partnerLocation: '', contactBeforeMeeting: '', photoExchangeBeforeMeeting: '',
            partnerAgeMin: 18, partnerAgeMax: 30, availableDays: [], availableTimeSlots: [],
            activityAreas: [], isComplete: false
          };
          setPreferences(defaultPrefs as MalePreferences);
          console.log('Set simplified default preferences for new user');
        }
      } catch (error) {
        console.error('Error loading existing preferences:', error);
        // エラーの場合もシンプルなデフォルト値を設定
        setPreferences({
          spanking: 3, outdoorPlay: 3, groupPlay: 3, throating: 3, bondage: 3,
          oralReceiving: 3, hypnosisPlay: 3, analPlay: 3, cosplay: 3, toyPlay: 3,
          verbalPlay: 3, squirting: 3, deepthroat: 3, partnerBodyTypes: [],
          experienceCount: '', recordingDuringPlay: '', isSadist: '', isMasochist: '',
          seekingType: '', partnerHeight: '', partnerWeight: '', partnerBodyType: '',
          partnerLocation: '', contactBeforeMeeting: '', photoExchangeBeforeMeeting: '',
          partnerAgeMin: 18, partnerAgeMax: 30, availableDays: [], availableTimeSlots: [],
          activityAreas: [], isComplete: false
        } as MalePreferences);
      } finally {
        setLoadingInitialData(false);
        console.log('Initial data loading completed');
      }
    };

    if (userId) {
      loadExistingPreferences();
    } else {
      console.log('No userId provided, skipping preferences load');
      setLoadingInitialData(false);
    }
  }, [userId]);

  // ステップが変わるたびに自動保存（進む時のみ）
  const saveCurrentProgress = async () => {
    try {
      console.log('Saving current progress for step:', currentStep);
      console.log('Current preferences:', preferences);
      await saveMalePreferences(userId, preferences);
      console.log('Progress saved successfully');
    } catch (error) {
      console.error('Error saving progress:', error);
      // 進行をブロックしないためにエラーを飲み込む
    }
  };

  // 評価スケールのレンダリング
  const renderRatingScale = (label: string, field: keyof MalePreferences, value: number) => (
    <div className="space-y-3 mb-6">
      <h3 className="text-base font-medium text-gray-900">{label}</h3>
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              onClick={() => setPreferences(prev => ({ ...prev, [field]: rating }))}
              className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-semibold transition-all ${
                value === rating
                  ? 'bg-[#F0306A] border-[#F0306A] text-white'
                  : 'border-gray-300 text-gray-500 hover:border-[#F0306A]/50'
              }`}
            >
              {rating}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-between text-sm text-gray-500">
        <span>全く</span>
        <span>とっても</span>
      </div>
    </div>
  );

  // Step 1: セクシュアル嗜好 (1/3)
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">あなたの嗜好について</h2>
        <p className="text-gray-600">1から5の段階で評価してください</p>
      </div>
      
      {renderRatingScale('スパンキングは好き・興味ありますか？', 'spanking', preferences.spanking)}
      {renderRatingScale('野外プレイは好き・興味ありますか？', 'outdoorPlay', preferences.outdoorPlay)}
      {renderRatingScale('複数人プレイは好き・興味ありますか？', 'groupPlay', preferences.groupPlay)}
    </div>
  );

  // Step 2: セクシュアル嗜好 (2/3)  
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">あなたの嗜好について</h2>
        <p className="text-gray-600">1から5の段階で評価してください</p>
      </div>
      
      {renderRatingScale('ゴックンは好き・興味ありますか？', 'throating', preferences.throating)}
      {renderRatingScale('首絞めプレイは好き・興味ありますか？', 'bondage', preferences.bondage)}
      {renderRatingScale('噛む・噛まれるのは好き・興味ありますか？', 'oralReceiving', preferences.oralReceiving)}
      {renderRatingScale('催眠プレイは好き・興味ありますか？', 'hypnosisPlay', preferences.hypnosisPlay)}
      {renderRatingScale('アナルプレイは好き・興味ありますか？', 'analPlay', preferences.analPlay)}
    </div>
  );

  // Step 3: セクシュアル嗜好 (3/3)
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">あなたの嗜好について</h2>
        <p className="text-gray-600">1から5の段階で評価してください</p>
      </div>
      
      {renderRatingScale('コスプレプレイは好き・興味ありますか？', 'cosplay', preferences.cosplay)}
      {renderRatingScale('おもちゃを使うのは好き・興味ありますか？', 'toyPlay', preferences.toyPlay)}
      {renderRatingScale('言葉責めプレイは好き・興味ありますか？', 'verbalPlay', preferences.verbalPlay)}
      {renderRatingScale('潮吹きは好き・興味ありますか？', 'squirting', preferences.squirting)}
      {renderRatingScale('イラマチオは好き・興味ありますか？', 'deepthroat', preferences.deepthroat)}
    </div>
  );

  // Step 4: 相手の体型
  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">相手の体型</h2>
        <p className="text-gray-600">希望する体型を選択してください（複数選択可）</p>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {[
          'スリム', 'やや細め', '細め', 'グラマー',
          '筋肉質', 'ややぽっちゃり', 'ぽっちゃり', 'こだわらない'
        ].map((bodyType) => (
          <div key={bodyType} className="flex items-center space-x-2 p-3 border rounded-lg">
            <Checkbox
              id={bodyType}
              checked={preferences.partnerBodyTypes?.includes(bodyType) || false}
              onCheckedChange={(checked) => {
                if (checked) {
                  setPreferences(prev => ({
                    ...prev,
                    partnerBodyTypes: [...(prev.partnerBodyTypes || []), bodyType]
                  }));
                } else {
                  setPreferences(prev => ({
                    ...prev,
                    partnerBodyTypes: (prev.partnerBodyTypes || []).filter(t => t !== bodyType)
                  }));
                }
              }}
            />
            <Label htmlFor={bodyType} className="text-sm font-medium">
              {bodyType}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );

  // Step 5: 基本情報
  const renderStep5 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-[#F0306A] text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">
          5/8
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">プロフィール入力</h2>
        <p className="text-gray-600">相手に求める条件を入力してください</p>
      </div>
      
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <p className="text-sm text-gray-700">
          このアカウントは{userEmail || 'メールアドレス'}で登録されています。
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-base font-medium">会う前の連絡</Label>
          <RadioGroup
            value={preferences.contactBeforeMeeting}
            onValueChange={(value) => setPreferences(prev => ({ ...prev, contactBeforeMeeting: value }))}
            className="grid grid-cols-2 gap-3 mt-2"
          >
            {[
              { value: 'したくない', label: 'したくない' },
              { value: 'できればしたい', label: 'できればしたい' },
              { value: '相手が望むなら', label: '相手が望むなら' },
              { value: '絶対にしたい', label: '絶対にしたい' }
            ].map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={`contact-${option.value}`} />
                <Label htmlFor={`contact-${option.value}`} className="text-sm">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div>
          <Label className="text-base font-medium">会う前の写真交換</Label>
          <RadioGroup
            value={preferences.photoExchangeBeforeMeeting}
            onValueChange={(value) => setPreferences(prev => ({ ...prev, photoExchangeBeforeMeeting: value }))}
            className="grid grid-cols-2 gap-3 mt-2"
          >
            {[
              { value: 'したくない', label: 'したくない' },
              { value: 'できればしたい', label: 'できればしたい' },
              { value: '相手が望むなら', label: '相手が望むなら' },
              { value: '絶対にしたい', label: '絶対にしたい' }
            ].map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={`photo-${option.value}`} />
                <Label htmlFor={`photo-${option.value}`} className="text-sm">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div>
          <Label className="text-base font-medium">相手の年齢</Label>
          <div className="flex items-center space-x-3 mt-2">
            <Select value={preferences.partnerAgeMin?.toString()} onValueChange={(value) => setPreferences(prev => ({ ...prev, partnerAgeMin: parseInt(value) }))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 83 }, (_, i) => i + 18).map((age) => (
                  <SelectItem key={age} value={age.toString()}>{age}歳</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-gray-500">〜</span>
            <Select value={preferences.partnerAgeMax?.toString()} onValueChange={(value) => setPreferences(prev => ({ ...prev, partnerAgeMax: parseInt(value) }))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 83 }, (_, i) => i + 18).map((age) => (
                  <SelectItem key={age} value={age.toString()}>{age}歳</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );

  // Step 6: 詳細な基本情報
  const renderStep6 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-[#F0306A] text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">
          4/8
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">プロフィール入力</h2>
        <p className="text-gray-600">あなたの基本情報を教えてください</p>
      </div>
      
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <p className="text-sm text-gray-700">
          このアカウントは{userEmail || 'メールアドレス'}で登録されています。
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-base font-medium">経験人数</Label>
          <Select value={preferences.experienceCount} onValueChange={(value) => setPreferences(prev => ({ ...prev, experienceCount: value }))}>
            <SelectTrigger className="w-full mt-2">
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0人">0人</SelectItem>
              <SelectItem value="1-5人">1-5人</SelectItem>
              <SelectItem value="6-10人">6-10人</SelectItem>
              <SelectItem value="11-20人">11-20人</SelectItem>
              <SelectItem value="21-50人">21-50人</SelectItem>
              <SelectItem value="50人以上">50人以上</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-base font-medium">プレイ時の撮影</Label>
          <Select value={preferences.recordingDuringPlay} onValueChange={(value) => setPreferences(prev => ({ ...prev, recordingDuringPlay: value }))}>
            <SelectTrigger className="w-full mt-2">
              <SelectValue placeholder="プレイ時の撮影を入力" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="しない">しない</SelectItem>
              <SelectItem value="相手が望むなら">相手が望むなら</SelectItem>
              <SelectItem value="したい">したい</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-base font-medium">あなたはSですか？</Label>
          <Select value={preferences.isSadist} onValueChange={(value) => setPreferences(prev => ({ ...prev, isSadist: value }))}>
            <SelectTrigger className="w-full mt-2">
              <SelectValue placeholder="あなたはSですか？" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="はい">はい</SelectItem>
              <SelectItem value="いいえ">いいえ</SelectItem>
              <SelectItem value="わからない">わからない</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-base font-medium">あなたはMですか？</Label>
          <Select value={preferences.isMasochist} onValueChange={(value) => setPreferences(prev => ({ ...prev, isMasochist: value }))}>
            <SelectTrigger className="w-full mt-2">
              <SelectValue placeholder="あなたはMですか？" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="はい">はい</SelectItem>
              <SelectItem value="いいえ">いいえ</SelectItem>
              <SelectItem value="わからない">わからない</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  // Step 7: 相手の詳細条件
  const renderStep7 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-[#F0306A] text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">
          3/8
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">プロフィール入力</h2>
        <p className="text-gray-600">あなたの基本情報を教えてください</p>
      </div>
      
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <p className="text-sm text-gray-700">
          このアカウントは{userEmail || 'メールアドレス'}で登録されています。
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-base font-medium">あなたの求めるものは？</Label>
          <Select value={preferences.seekingType} onValueChange={(value) => setPreferences(prev => ({ ...prev, seekingType: value }))}>
            <SelectTrigger className="w-full mt-2">
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="恋人">恋人</SelectItem>
              <SelectItem value="セフレ">セフレ</SelectItem>
              <SelectItem value="友達">友達</SelectItem>
              <SelectItem value="結婚相手">結婚相手</SelectItem>
              <SelectItem value="不倫相手">不倫相手</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-base font-medium">相手の身長</Label>
          <Select value={preferences.partnerHeight} onValueChange={(value) => {
            console.log('Height selection changed to:', value);
            setPreferences(prev => ({ ...prev, partnerHeight: value }));
          }}>
            <SelectTrigger className="w-full mt-2">
              <SelectValue placeholder="相手の身長を選択してください" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="こだわらない">こだわらない</SelectItem>
              {Array.from({ length: 61 }, (_, i) => i + 140).map((height) => (
                <SelectItem key={height} value={`${height}cm`}>{height}cm</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-base font-medium">体重</Label>
          <Select value={preferences.partnerWeight} onValueChange={(value) => setPreferences(prev => ({ ...prev, partnerWeight: value }))}>
            <SelectTrigger className="w-full mt-2">
              <SelectValue placeholder="50kg" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 101 }, (_, i) => i + 40).map((weight) => (
                <SelectItem key={weight} value={`${weight}kg`}>{weight}kg</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-base font-medium">体型</Label>
          <Select value={preferences.partnerBodyType} onValueChange={(value) => setPreferences(prev => ({ ...prev, partnerBodyType: value }))}>
            <SelectTrigger className="w-full mt-2">
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="スリム">スリム</SelectItem>
              <SelectItem value="やや細め">やや細め</SelectItem>
              <SelectItem value="普通">普通</SelectItem>
              <SelectItem value="ややぽっちゃり">ややぽっちゃり</SelectItem>
              <SelectItem value="ぽっちゃり">ぽっちゃり</SelectItem>
              <SelectItem value="グラマー">グラマー</SelectItem>
              <SelectItem value="筋肉質">筋肉質</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-base font-medium">居住地</Label>
          <Select value={preferences.partnerLocation} onValueChange={(value) => setPreferences(prev => ({ ...prev, partnerLocation: value }))}>
            <SelectTrigger className="w-full mt-2">
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="北海道">北海道</SelectItem>
              <SelectItem value="東北">東北</SelectItem>
              <SelectItem value="関東">関東</SelectItem>
              <SelectItem value="中部">中部</SelectItem>
              <SelectItem value="関西">関西</SelectItem>
              <SelectItem value="中国">中国</SelectItem>
              <SelectItem value="四国">四国</SelectItem>
              <SelectItem value="九州・沖縄">九州・沖縄</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  // Step 8: 活動タイミング
  const renderStep8 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">活動タイミング</h2>
        <p className="text-gray-600">希望する活動タイミングを教えてください</p>
      </div>
      
      <div className="space-y-6">
        <div>
          <Label className="text-base font-medium mb-3 block">＜活動したい日＞</Label>
          <div className="grid grid-cols-3 gap-3">
            {['平日', '休日', '祝日'].map((day) => (
              <div key={day} className="flex items-center space-x-2 p-3 border rounded-lg">
                <Checkbox
                  id={day}
                  checked={preferences.availableDays?.includes(day) || false}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setPreferences(prev => ({
                        ...prev,
                        availableDays: [...(prev.availableDays || []), day]
                      }));
                    } else {
                      setPreferences(prev => ({
                        ...prev,
                        availableDays: (prev.availableDays || []).filter(d => d !== day)
                      }));
                    }
                  }}
                />
                <Label htmlFor={day} className="text-sm font-medium">
                  {day}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-base font-medium mb-3 block">＜活動したい時間帯＞</Label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: '朝', label: '🌅 朝', emoji: '🌅' },
              { value: '昼', label: '☀️ 昼', emoji: '☀️' },
              { value: '夜', label: '🌙 夜', emoji: '🌙' }
            ].map((timeSlot) => (
              <div key={timeSlot.value} className="flex items-center space-x-2 p-3 border rounded-lg">
                <Checkbox
                  id={timeSlot.value}
                  checked={preferences.availableTimeSlots?.includes(timeSlot.value) || false}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setPreferences(prev => ({
                        ...prev,
                        availableTimeSlots: [...(prev.availableTimeSlots || []), timeSlot.value]
                      }));
                    } else {
                      setPreferences(prev => ({
                        ...prev,
                        availableTimeSlots: (prev.availableTimeSlots || []).filter(t => t !== timeSlot.value)
                      }));
                    }
                  }}
                />
                <Label htmlFor={timeSlot.value} className="text-sm font-medium">
                  {timeSlot.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-base font-medium">活動エリア（1つ以上入力してください）</Label>
          <Select 
            value="" 
            onValueChange={(value) => {
              if (value && !preferences.activityAreas?.includes(value)) {
                setPreferences(prev => ({
                  ...prev,
                  activityAreas: [...(prev.activityAreas || []), value]
                }));
              }
            }}
          >
            <SelectTrigger className="w-full mt-2">
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              {[
                '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
                '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
                '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県',
                '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
                '鳥取県', '島根県', '岡山県', '広島県', '山口県',
                '徳島県', '香川県', '愛媛県', '高知県',
                '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
              ].map((area) => (
                <SelectItem key={area} value={area}>{area}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {preferences.activityAreas && preferences.activityAreas.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {preferences.activityAreas.map((area) => (
                <Badge key={area} variant="secondary" className="bg-[#F0306A]/10 text-[#F0306A]">
                  {area}
                  <button
                    onClick={() => setPreferences(prev => ({
                      ...prev,
                      activityAreas: (prev.activityAreas || []).filter(a => a !== area)
                    }))}
                    className="ml-2 text-xs"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const handleNext = async () => {
    console.log('=== handleNext START ===');
    console.log('Current step before update:', currentStep);
    console.log('TOTAL_STEPS:', TOTAL_STEPS);
    console.log('isLoading:', isLoading);
    console.log('loadingInitialData:', loadingInitialData);
    
    if (currentStep < TOTAL_STEPS) {
      console.log('Condition met: currentStep < TOTAL_STEPS');
      const nextStep = currentStep + 1;
      console.log('Setting step to:', nextStep);
      
      // React 18のuseTranistion or startTransitionを使用せず、直接更新
      setCurrentStep(prevStep => {
        console.log('Step update function called. Prev:', prevStep, 'Next:', prevStep + 1);
        return prevStep + 1;
      });
      
      console.log('Step update called');
      
      // その後バックグラウンドで保存
      setTimeout(() => {
        saveCurrentProgress().catch(error => {
          console.error('Background save failed:', error);
        });
      }, 100);
    } else {
      // 最後のステップ - 設定を保存して完了
      setIsLoading(true);
      try {
        const finalPreferences = {
          ...preferences,
          isComplete: true,
          completedAt: new Date().toISOString() // 完了時刻を明示的に設定
        };
        
        console.log('Saving final preferences:', finalPreferences);
        await saveMalePreferences(userId, finalPreferences);
        
        // 保存が成功したことを確認
        console.log('Male preferences saved successfully');
        
        toast({
          title: "設定完了！",
          description: "プロフィール設定が完了しました。ホームページに移動します。",
        });
        
        // 少し待ってから完了処理を実行（確実に保存されるまで）
        setTimeout(() => {
          onComplete();
        }, 1000);
        
      } catch (error) {
        console.error('Error saving preferences:', error);
        toast({
          title: "エラー",
          description: "設定の保存に失敗しました。もう一度お試しください。",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else if (onBack) {
      onBack();
    }
  };

  if (loadingInitialData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F0306A] via-[#FF69B4] to-[#FF1493] flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>設定を読み込んでいます...</p>
          <p className="text-xs mt-2">Loading: {loadingInitialData ? 'true' : 'false'}</p>
        </div>
      </div>
    );
  }

  // デバッグ情報を画面に表示
  console.log('Component render - Current Step:', currentStep, 'Loading:', loadingInitialData, 'Is Loading:', isLoading);

  const progress = (currentStep / TOTAL_STEPS) * 100;

  const renderCurrentStep = () => {
    console.log('Rendering step:', currentStep);
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      case 7: return renderStep7();
      case 8: return renderStep8();
      default: 
        console.warn('Unknown step:', currentStep);
        return renderStep1();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0306A] via-[#FF69B4] to-[#FF1493] p-4">
      <div className="max-w-2xl mx-auto">
        {/* Progress Header */}
        <div className="text-center mb-6 pt-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-[#F0306A]">
                {currentStep}/{TOTAL_STEPS}
              </span>
            </div>
          </div>
          <Progress value={progress} className="w-full h-3 mb-4" />
          <h1 className="text-2xl font-bold text-white">プロフィール入力</h1>
          <p className="text-white/90">相手に求める条件を入力してください</p>
          
        </div>

        {/* Content Card */}
        <Card className="bg-white shadow-xl">
          <CardContent className="p-6">
            {renderCurrentStep()}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6 pb-6">
          <Button
            variant="outline"
            onClick={handleBack}
            className="bg-white/20 border-white/30 text-white hover:bg-white/30"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            戻る
          </Button>
          
          <Button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('=== BUTTON CLICKED ===');
              console.log('Event:', e);
              console.log('Button disabled?', isLoading || loadingInitialData);
              console.log('isLoading:', isLoading);
              console.log('loadingInitialData:', loadingInitialData);
              
              if (!isLoading && !loadingInitialData) {
                console.log('Button not disabled, calling handleNext');
                handleNext();
              } else {
                console.log('Button is disabled, not calling handleNext');
              }
            }}
            disabled={isLoading || loadingInitialData}
            className="bg-white text-[#F0306A] hover:bg-white/90"
            type="button"
          >
            {isLoading ? (
              "保存中..."
            ) : loadingInitialData ? (
              "読み込み中..."
            ) : currentStep === TOTAL_STEPS ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                完了
              </>
            ) : (
              <>
                進む
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}