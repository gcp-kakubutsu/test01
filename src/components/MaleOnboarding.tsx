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

const TOTAL_STEPS = 7;

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
      <h3 className="text-base font-medium text-white">{label}</h3>
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              onClick={() => setPreferences(prev => ({ ...prev, [field]: rating }))}
              className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-semibold transition-all ${
                value === rating
                  ? 'bg-[#F0306A] border-[#F0306A] text-white shadow-lg shadow-[#F0306A]/30'
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-[#F0306A]/50 hover:bg-gray-700'
              }`}
            >
              {rating}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-between text-sm text-gray-400">
        <span>全く</span>
        <span>とっても</span>
      </div>
    </div>
  );

  // Step 1: セクシュアル嗜好 (1/3)
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-2">あなたの嗜好について</h2>
        <p className="text-gray-300">1から5の段階で評価してください</p>
      </div>
      
      {renderRatingScale('スパンキングは好き・興味ありますか？', 'spanking', preferences.spanking)}
      {renderRatingScale('複数人プレイは好き・興味ありますか？', 'groupPlay', preferences.groupPlay)}
    </div>
  );

  // Step 2: セクシュアル嗜好 (2/3)  
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-2">あなたの嗜好について</h2>
        <p className="text-gray-300">1から5の段階で評価してください</p>
      </div>
      
      {renderRatingScale('ゴックンは好き・興味ありますか？', 'throating', preferences.throating)}
      {renderRatingScale('アナルプレイは好き・興味ありますか？', 'analPlay', preferences.analPlay)}
    </div>
  );

  // Step 3: セクシュアル嗜好 (3/3)
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-2">あなたの嗜好について</h2>
        <p className="text-gray-300">1から5の段階で評価してください</p>
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
        <h2 className="text-xl font-bold text-white mb-2">相手の体型</h2>
        <p className="text-gray-300">希望する体型を選択してください（複数選択可）</p>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {[
          'スリム', 'やや細め', '細め', 'グラマー',
          '筋肉質', 'ややぽっちゃり', 'ぽっちゃり', 'こだわらない'
        ].map((bodyType) => (
          <div 
            key={bodyType} 
            className="flex items-center space-x-2 p-3 border border-gray-600 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors"
            onClick={() => {
              const isChecked = preferences.partnerBodyTypes?.includes(bodyType) || false;
              if (!isChecked) {
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
          >
            <Checkbox
              id={bodyType}
              checked={preferences.partnerBodyTypes?.includes(bodyType) || false}
              className="data-[state=checked]:bg-[#F0306A] data-[state=checked]:border-[#F0306A]"
            />
            <Label htmlFor={bodyType} className="text-sm font-medium cursor-pointer text-gray-200">
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
        <h2 className="text-xl font-bold text-white mb-2">プロフィール入力</h2>
        <p className="text-gray-300">相手に求める条件を入力してください</p>
      </div>
      

      <div className="space-y-4">
        <div>
          <Label className="text-base font-medium text-white">会う前の写真交換</Label>
          <Select value={preferences.photoExchangeBeforeMeeting} onValueChange={(value) => setPreferences(prev => ({ ...prev, photoExchangeBeforeMeeting: value }))}>
            <SelectTrigger className="w-full mt-2 bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="する">する</SelectItem>
              <SelectItem value="しない">しない</SelectItem>
              <SelectItem value="相手次第">相手次第</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-base font-medium text-white">相手の年齢</Label>
          <div className="flex items-center space-x-3 mt-2">
            <Select value={preferences.partnerAgeMin?.toString()} onValueChange={(value) => setPreferences(prev => ({ ...prev, partnerAgeMin: parseInt(value) }))}>
              <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {Array.from({ length: 83 }, (_, i) => i + 18).map((age) => (
                  <SelectItem key={age} value={age.toString()}>{age}歳</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-gray-400">〜</span>
            <Select value={preferences.partnerAgeMax?.toString()} onValueChange={(value) => setPreferences(prev => ({ ...prev, partnerAgeMax: parseInt(value) }))}>
              <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
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
        <h2 className="text-xl font-bold text-white mb-2">プロフィール入力</h2>
        <p className="text-gray-300">あなたの基本情報を教えてください</p>
      </div>
      

      <div className="space-y-4">

        <div>
          <Label className="text-base font-medium text-white">プレイ時の撮影</Label>
          <Select value={preferences.recordingDuringPlay} onValueChange={(value) => setPreferences(prev => ({ ...prev, recordingDuringPlay: value }))}>
            <SelectTrigger className="w-full mt-2 bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="プレイ時の撮影を入力" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="しない">しない</SelectItem>
              <SelectItem value="したい">したい</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-base font-medium text-white">あなたはSですか？</Label>
          <Select value={preferences.isSadist} onValueChange={(value) => setPreferences(prev => ({ ...prev, isSadist: value }))}>
            <SelectTrigger className="w-full mt-2 bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="あなたはSですか？" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="はい">はい</SelectItem>
              <SelectItem value="いいえ">いいえ</SelectItem>
              <SelectItem value="わからない">わからない</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-base font-medium text-white">あなたはMですか？</Label>
          <Select value={preferences.isMasochist} onValueChange={(value) => setPreferences(prev => ({ ...prev, isMasochist: value }))}>
            <SelectTrigger className="w-full mt-2 bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="あなたはMですか？" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
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
        <h2 className="text-xl font-bold text-white mb-2">プロフィール入力</h2>
        <p className="text-gray-300">あなたの基本情報を教えてください</p>
      </div>
      

      <div className="space-y-4">

        <div>
          <Label className="text-base font-medium text-white">相手の身長</Label>
          <Select value={preferences.partnerHeight} onValueChange={(value) => {
            console.log('Height selection changed to:', value);
            setPreferences(prev => ({ ...prev, partnerHeight: value }));
          }}>
            <SelectTrigger className="w-full mt-2 bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="相手の身長を選択してください" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="こだわらない">こだわらない</SelectItem>
              {Array.from({ length: 61 }, (_, i) => i + 140).map((height) => (
                <SelectItem key={height} value={`${height}cm`}>{height}cm</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-base font-medium text-white">相手の体重</Label>
          <Select value={preferences.partnerWeight} onValueChange={(value) => setPreferences(prev => ({ ...prev, partnerWeight: value }))}>
            <SelectTrigger className="w-full mt-2 bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="相手の体重を選択してください" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="こだわらない">こだわらない</SelectItem>
              {Array.from({ length: 101 }, (_, i) => i + 40).map((weight) => (
                <SelectItem key={weight} value={`${weight}kg`}>{weight}kg</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-base font-medium text-white">体型</Label>
          <Select value={preferences.partnerBodyType} onValueChange={(value) => setPreferences(prev => ({ ...prev, partnerBodyType: value }))}>
            <SelectTrigger className="w-full mt-2 bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
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
          <Label className="text-base font-medium text-white">居住地</Label>
          <Select value={preferences.partnerLocation} onValueChange={(value) => setPreferences(prev => ({ ...prev, partnerLocation: value }))}>
            <SelectTrigger className="w-full mt-2 bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
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


  // ステップのバリデーション
  const validateCurrentStep = (): boolean => {
    console.log('=== VALIDATION CHECK START ===');
    console.log('Current step:', currentStep);
    console.log('Current preferences:', preferences);
    
    switch (currentStep) {
      case 5: // Step 5: 基本情報
        const step5Valid = !!(
          preferences.photoExchangeBeforeMeeting &&
          preferences.partnerAgeMin > 0 &&
          preferences.partnerAgeMax > 0
        );
        console.log('Step 5 validation:', {
          photoExchangeBeforeMeeting: preferences.photoExchangeBeforeMeeting,
          partnerAgeMin: preferences.partnerAgeMin,
          partnerAgeMax: preferences.partnerAgeMax,
          result: step5Valid
        });
        return step5Valid;
      case 6: // Step 6: 詳細な基本情報
        const step6Valid = !!(
          preferences.recordingDuringPlay &&
          preferences.isSadist &&
          preferences.isMasochist
        );
        console.log('Step 6 validation:', {
          recordingDuringPlay: preferences.recordingDuringPlay,
          isSadist: preferences.isSadist,
          isMasochist: preferences.isMasochist,
          result: step6Valid
        });
        return step6Valid;
      case 7: // Step 7: 相手の詳細条件
        const step7Valid = !!(
          preferences.partnerHeight &&
          preferences.partnerWeight &&
          preferences.partnerBodyType &&
          preferences.partnerLocation
        );
        console.log('Step 7 validation:', {
          partnerHeight: preferences.partnerHeight,
          partnerWeight: preferences.partnerWeight,
          partnerBodyType: preferences.partnerBodyType,
          partnerLocation: preferences.partnerLocation,
          result: step7Valid
        });
        return step7Valid;
      default:
        console.log('No validation required for step:', currentStep);
        return true; // その他のステップはバリデーション不要
    }
  };

  const handleNext = async () => {
    console.log('=== handleNext START ===');
    console.log('Current step before update:', currentStep);
    console.log('TOTAL_STEPS:', TOTAL_STEPS);
    console.log('isLoading:', isLoading);
    console.log('loadingInitialData:', loadingInitialData);
    
    // バリデーションチェック
    if (!validateCurrentStep()) {
      toast({
        title: "入力不備",
        description: "すべての項目を入力してください。",
        variant: "destructive",
      });
      return;
    }
    
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
      <div className="min-h-screen bg-black flex items-center justify-center">
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
      default: 
        console.warn('Unknown step:', currentStep);
        return renderStep1();
    }
  };

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-2xl mx-auto">
        {/* Progress Header */}
        <div className="text-center mb-6 pt-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-[#F0306A] rounded-full flex items-center justify-center shadow-lg shadow-[#F0306A]/30">
              <span className="text-2xl font-bold text-white">
                {currentStep}/{TOTAL_STEPS}
              </span>
            </div>
          </div>
          <Progress value={progress} className="w-full h-3 mb-4 bg-gray-800" />
          <h1 className="text-2xl font-bold text-white">プロフィール入力</h1>
          <p className="text-gray-300">相手に求める条件を入力してください</p>
        </div>

        {/* Content Card */}
        <Card className="bg-gray-900 border-gray-800 shadow-xl">
          <CardContent className="p-6">
            {renderCurrentStep()}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6 pb-6">
          <Button
            variant="outline"
            onClick={handleBack}
            className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
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
            className="bg-[#F0306A] text-white hover:bg-[#F0306A]/90 shadow-lg shadow-[#F0306A]/30"
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