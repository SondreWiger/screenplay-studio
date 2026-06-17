'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button, Card, Modal, Input, LoadingPage, toast } from '@/components/ui';

interface Language {
  id: string;
  code: string;
  name: string;
  native_name: string;
  added_by: string;
  status: string;
}

interface Contributor {
  user_id: string;
  count: number;
  display_name: string;
  avatar_url: string;
}

export default function TranslationsPage() {
  const { user } = useAuth();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [totalKeys, setTotalKeys] = useState(0);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAgreeModal, setShowAgreeModal] = useState(false);
  const [showAddLanguageModal, setShowAddLanguageModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizLanguage, setQuizLanguage] = useState<{ code: string; name: string } | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<any>(null);
  const [quizCooldown, setQuizCooldown] = useState(false);
  const [newLang, setNewLang] = useState({ code: '', name: '', native_name: '' });


  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    const supabase = createClient();

    const { data: agreement } = await supabase
      .from('translation_agreements')
      .select('id')
      .eq('user_id', user!.id)
      .single();

    setAgreed(!!agreement);

    const res = await fetch('/api/translations/languages');
    if (res.ok) {
      const data = await res.json();
      setLanguages(data.languages);
      setTotalKeys(data.total_keys);
      setProgress(data.progress);
      setContributors(data.contributors);
    }

    setLoading(false);
  };

  const handleAgree = async () => {
    const res = await fetch('/api/translations/agree', { method: 'POST' });
    if (res.ok) {
      setAgreed(true);
      setShowAgreeModal(false);
      toast.success('You can now contribute translations!');
    }
  };

  const startQuiz = async (lang: { code: string; name: string }) => {
    setQuizLanguage(lang);
    setQuizQuestions([]);
    setQuizAnswers([]);
    setQuizResult(null);
    setQuizCooldown(false);

    const res = await fetch(`/api/translations/quiz?language=${lang.code}`);
    if (res.ok) {
      const data = await res.json();
      if (data.cooldown) {
        setQuizCooldown(true);
        setShowQuizModal(true);
      } else if (data.questions.length > 0) {
        setQuizQuestions(data.questions);
        setQuizAnswers(new Array(data.questions.length).fill(-1));
        setShowQuizModal(true);
      } else {
        await submitLanguageDirect(lang.code);
      }
    } else {
      await submitLanguageDirect(lang.code);
    }
  };

  const submitLanguageDirect = async (langCode: string) => {
    const res = await fetch('/api/translations/languages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: newLang.code || langCode,
        name: newLang.name,
        native_name: newLang.native_name,
      }),
    });

    if (res.ok) {
      toast.success('Language added! You can start translating.');
      setShowAddLanguageModal(false);
      setShowQuizModal(false);
      setNewLang({ code: '', name: '', native_name: '' });
      fetchData();
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to add language');
    }
  };

  const submitQuiz = async () => {
    if (!quizLanguage) return;
    setQuizSubmitting(true);

    const res = await fetch('/api/translations/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language_code: quizLanguage.code,
        answers: quizAnswers,
      }),
    });

    const data = await res.json();
    setQuizResult(data);
    setQuizSubmitting(false);

    if (data.passed) {
      toast.success(`Quiz passed! You can now translate to ${quizLanguage.name}.`);
    }
  };


  if (loading) return <LoadingPage />;

  return (
    <div className="min-h-screen" style={{ background: '#070710' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-medium text-[#FF5F1F] uppercase tracking-wider mb-3">Community</p>
          <h1 className="text-3xl font-black text-white tracking-tight">Translator Hub</h1>
          <p className="text-surface-400 mt-2 max-w-xl">
            Help translate Screenplay Studio into your language. Suggest translations, vote on the best ones, and make the app accessible to creators worldwide.
          </p>
        </div>

        {/* Agreement gate */}
        {!agreed && (
          <Card className="p-6 mb-8 border-[#FF5F1F]/20 bg-[#FF5F1F]/5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#FF5F1F]/10 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[#FF5F1F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">Agree to Translation Guidelines</h3>
                <p className="text-sm text-surface-400 mt-1">
                  You must read and accept our translation guidelines before contributing. This ensures quality and protects the community.
                </p>
                <div className="flex gap-3 mt-4">
                  <Button size="sm" onClick={() => setShowAgreeModal(true)}>
                    Read & Agree
                  </Button>
                  <Link href="/legal/translation-guidelines" className="text-xs text-surface-400 hover:text-white transition-colors self-center">
                    Read guidelines first
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="p-5">
            <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">Languages</p>
            <p className="text-2xl font-black text-white mt-1">{languages.length}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">Translation Keys</p>
            <p className="text-2xl font-black text-white mt-1">{totalKeys}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">Contributors</p>
            <p className="text-2xl font-black text-white mt-1">{contributors.length}</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Languages */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Languages</h2>
              <Button size="sm" variant="secondary" onClick={() => {
                if (!agreed) {
                  setShowAgreeModal(true);
                } else {
                  setShowAddLanguageModal(true);
                }
              }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Language
              </Button>
            </div>

            {languages.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-surface-400">No languages added yet. Be the first to contribute!</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {languages.map((lang) => (
                  <Link key={lang.id} href={`/translations/${lang.code}`}>
                    <Card className="p-5 hover:border-surface-600 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-semibold text-white">{lang.name}</span>
                            <span className="text-sm text-surface-500">({lang.native_name})</span>
                            <span className="text-xs font-mono text-surface-600 bg-surface-800 px-2 py-0.5 rounded">{lang.code}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-white">{progress[lang.code] || 0}%</p>
                            <p className="text-[10px] text-surface-500">translated</p>
                          </div>
                          <div className="w-24 h-2 bg-surface-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#E54E15] to-[#FF5F1F] rounded-full transition-all"
                              style={{ width: `${progress[lang.code] || 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Contributors sidebar */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Top Contributors</h2>
            {contributors.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-sm text-surface-400">No contributions yet</p>
              </Card>
            ) : (
              <Card className="divide-y divide-surface-800/60">
                {contributors.slice(0, 10).map((c, i) => (
                  <div key={c.user_id} className="flex items-center gap-3 p-4">
                    <span className="text-xs font-mono text-surface-600 w-5">#{i + 1}</span>
                    <div className="w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center overflow-hidden">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-white">
                          {(c.display_name || '?')[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{c.display_name || 'Anonymous'}</p>
                      <p className="text-[10px] text-surface-500">{c.count} translation{c.count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Agree Modal */}
      <Modal isOpen={showAgreeModal} onClose={() => setShowAgreeModal(false)} title="Translation Guidelines">
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          <p className="text-sm text-surface-300">
            Before contributing translations, you must agree to our guidelines. Key points:
          </p>
          <ul className="space-y-2 text-sm text-surface-400">
            <li className="flex gap-2">
              <svg className="w-4 h-4 text-[#FF5F1F] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Be genuinely fluent in the language you translate to
            </li>
            <li className="flex gap-2">
              <svg className="w-4 h-4 text-[#FF5F1F] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Provide accurate, natural translations (no raw machine translations)
            </li>
            <li className="flex gap-2">
              <svg className="w-4 h-4 text-[#FF5F1F] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              No hate speech, spam, or prohibited content
            </li>
            <li className="flex gap-2">
              <svg className="w-4 h-4 text-[#FF5F1F] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              No vote manipulation or coordinated voting
            </li>
            <li className="flex gap-2">
              <svg className="w-4 h-4 text-[#FF5F1F] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Admins may remove translations that violate guidelines
            </li>
          </ul>
          <p className="text-xs text-surface-500">
            Full guidelines: <Link href="/legal/translation-guidelines" className="text-[#FF5F1F] hover:underline">/legal/translation-guidelines</Link>
          </p>
        </div>
        <div className="flex gap-3 mt-6">
          <Button onClick={handleAgree}>I Agree to the Guidelines</Button>
          <Button variant="ghost" onClick={() => setShowAgreeModal(false)}>Cancel</Button>
        </div>
      </Modal>

      {/* Add Language Modal */}
      <Modal isOpen={showAddLanguageModal} onClose={() => setShowAddLanguageModal(false)} title="Add a Language">
        <div className="space-y-4">
          <p className="text-sm text-surface-400">
            Add your native language to the Translator Hub. You&apos;ll need to pass a quick fluency quiz first.
          </p>
          <Input
            label="Language Code (ISO 639-1)"
            placeholder="e.g. no, fr, de, km"
            value={newLang.code}
            onChange={(e) => setNewLang({ ...newLang, code: e.target.value.toLowerCase().slice(0, 10) })}
          />
          <Input
            label="Language Name (English)"
            placeholder="e.g. Norwegian, French, German"
            value={newLang.name}
            onChange={(e) => setNewLang({ ...newLang, name: e.target.value })}
          />
          <Input
            label="Native Name"
            placeholder="e.g. Norsk, Français, Deutsch"
            value={newLang.native_name}
            onChange={(e) => setNewLang({ ...newLang, native_name: e.target.value })}
          />
        </div>
        <div className="flex gap-3 mt-6">
          <Button
            onClick={() => {
              if (newLang.code && newLang.name) {
                setShowAddLanguageModal(false);
                startQuiz({ code: newLang.code, name: newLang.name });
              }
            }}
            disabled={!newLang.code || !newLang.name || !newLang.native_name}
          >
            Take Fluency Quiz
          </Button>
          <Button variant="ghost" onClick={() => setShowAddLanguageModal(false)}>Cancel</Button>
        </div>
      </Modal>

      {/* Quiz Modal */}
      <Modal isOpen={showQuizModal} onClose={() => setShowQuizModal(false)} title={`Fluency Quiz: ${quizLanguage?.name || ''}`}>
        {quizCooldown ? (
          <div className="text-center py-6">
            <p className="text-surface-400">You must wait 24 hours between quiz attempts.</p>
            <p className="text-sm text-surface-500 mt-2">Try again later.</p>
          </div>
        ) : quizResult ? (
          <div className="text-center py-6">
            {quizResult.passed ? (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-white">Quiz Passed!</h3>
                <p className="text-surface-400 mt-1">Score: {quizResult.score}/{quizResult.total}</p>
                <p className="text-sm text-surface-500 mt-2">You can now submit your language request and start translating.</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-white">Not Quite</h3>
                <p className="text-surface-400 mt-1">Score: {quizResult.score}/{quizResult.total} (need {quizResult.min_score}+)</p>
                <p className="text-sm text-surface-500 mt-2">You can retry in 24 hours.</p>
              </>
            )}
            <Button className="mt-6" onClick={() => setShowQuizModal(false)}>Close</Button>
          </div>
        ) : (
          <>
            <div className="space-y-6 max-h-96 overflow-y-auto pr-2">
              <p className="text-sm text-surface-400">
                Answer these questions to verify you speak {quizLanguage?.name}. You need {quizQuestions.length > 0 ? '3' : '?'} out of {quizQuestions.length || '?'} correct.
              </p>
              {quizQuestions.map((q: any, i: number) => (
                <div key={i} className="space-y-2">
                  <p className="text-sm font-medium text-white">{i + 1}. {q.question}</p>
                  <div className="space-y-1">
                    {q.options.map((opt: string, j: number) => (
                      <button
                        key={j}
                        onClick={() => {
                          const newAnswers = [...quizAnswers];
                          newAnswers[i] = j;
                          setQuizAnswers(newAnswers);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          quizAnswers[i] === j
                            ? 'bg-[#FF5F1F]/10 border border-[#FF5F1F]/40 text-white'
                            : 'bg-surface-800/50 border border-surface-700/50 text-surface-400 hover:border-surface-600'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                onClick={submitQuiz}
                loading={quizSubmitting}
                disabled={quizAnswers.some(a => a === -1)}
              >
                Submit Quiz
              </Button>
              <Button variant="ghost" onClick={() => setShowQuizModal(false)}>Cancel</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
