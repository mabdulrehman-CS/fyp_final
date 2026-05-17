import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Download, Award, Brain, Code2, Eye, TrendingUp, ExternalLink, ChevronDown, ChevronUp, AlertTriangle, FileText } from 'lucide-react';
import { aiInterviewAPI } from '@/lib/api';

const ReportView: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const reportDataFromState = (location.state as any)?.reportData;
  const fromReports = (location.state as any)?.from === 'reports';

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      try {
        const data = await aiInterviewAPI.getReport(sessionId);
        setReport({ ...data, ...(reportDataFromState || {}) });
      } catch {
        if (reportDataFromState) setReport(reportDataFromState);
      }
      setLoading(false);
    };
    load();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 flex items-center justify-center">
        <div className="animate-pulse text-white text-lg">Loading your report...</div>
      </div>
    );
  }

  const finalReport = report?.final_report || report || {};
  const overall = finalReport.overall_score || 0;
  const technical = finalReport.technical_score || 0;
  const behavioral = finalReport.behavioral_score || 0;
  const coding = finalReport.coding_score || 0;
  const qaResponses = report?.qa_responses || [];
  const proctoringEvents = report?.proctoring_events || [];
  const recommendations = finalReport.recommendations || [];
  const behavioralData = report?.behavioral_data || {};

  const getScoreColor = (s: number) => s >= 70 ? 'text-emerald-400' : s >= 40 ? 'text-yellow-400' : 'text-red-400';
  const getScoreBg = (s: number) => s >= 70 ? 'from-emerald-500/20 to-emerald-600/10' : s >= 40 ? 'from-yellow-500/20 to-yellow-600/10' : 'from-red-500/20 to-red-600/10';
  const getScoreBorder = (s: number) => s >= 70 ? 'border-emerald-500/30' : s >= 40 ? 'border-yellow-500/30' : 'border-red-500/30';

  // Simple donut chart using SVG
  const DonutChart = ({ value, size = 160 }: { value: number; size?: number }) => {
    const r = (size - 16) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (value / 100) * circ;
    const color = value >= 70 ? '#34d399' : value >= 40 ? '#fbbf24' : '#f87171';
    return (
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
          className="fill-white text-3xl font-bold" transform={`rotate(90 ${size/2} ${size/2})`}>
          {Math.round(value)}%
        </text>
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 print:bg-none print:bg-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 print:mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white print:text-black mb-1">
              {report?.interview_mode === 'course' ? `${report?.course} Report` : 'Interview Report'}
            </h1>
            <p className="text-gray-400 print:text-gray-600">
              {report?.candidate_name || 'Candidate'} • {report?.interview_mode === 'course' ? `Course: ${report?.course}` : `Position: ${report?.position || 'N/A'}`} • Session {sessionId?.slice(0, 8)}
            </p>
          </div>
          <div className="flex items-center gap-4 print:hidden">
            {sessionId && (
              <a href={aiInterviewAPI.getReportPdfUrl(sessionId)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
                <Download className="w-4 h-4" /> Download PDF
              </a>
            )}
            <button 
              onClick={() => window.print()}
              className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
            >
              Print HTML
            </button>
            <button 
              onClick={() => fromReports ? navigate('/candidate/reports') : navigate('/candidate/dashboard')}
              className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
            >
              {fromReports ? '← Back' : 'Back'}
            </button>
          </div>
        </div>

        {/* Overall Score */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/5 print:bg-gray-100 backdrop-blur-xl rounded-2xl border border-white/10 print:border-gray-300 p-8 text-center print:shadow-sm">
            <p className="text-gray-400 print:text-gray-600 mb-4 text-sm font-medium uppercase tracking-wider">Overall Performance</p>
            <div className="print:hidden"><DonutChart value={overall} /></div>
            <div className="hidden print:block text-5xl font-bold" style={{ color: overall >= 70 ? '#16a34a' : overall >= 40 ? '#d97706' : '#dc2626' }}>
              {Math.round(overall)}%
            </div>
          </div>
        </div>

        {/* Score cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Technical Q&A', score: technical, icon: Brain },
            { label: 'Behavioral', score: behavioral, icon: Eye },
            { label: 'Coding Challenge', score: coding, icon: Code2 },
          ].map(({ label, score, icon: Icon }) => (
            <div key={label} className={`bg-gradient-to-br ${getScoreBg(score)} print:bg-none print:bg-gray-50 rounded-2xl border ${getScoreBorder(score)} print:border-gray-200 p-6 text-center`}>
              <Icon className={`w-8 h-8 ${getScoreColor(score)} print:text-gray-700 mx-auto mb-3`} />
              <p className="text-gray-300 print:text-gray-600 text-sm mb-2">{label}</p>
              <p className={`text-3xl font-bold ${getScoreColor(score)} print:text-black`}>{Math.round(score)}%</p>
            </div>
          ))}
        </div>

        {/* Q&A Breakdown */}
        {qaResponses.length > 0 && (
          <div className="mb-8 print:break-inside-avoid">
            <h2 className="text-xl font-bold text-white print:text-black mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400 print:text-indigo-600" /> Q&A Breakdown
            </h2>
            <div className="space-y-2">
              {qaResponses.map((r: any, i: number) => (
                <div key={i} className="bg-white/5 print:bg-white rounded-xl border border-white/10 print:border-gray-200 overflow-hidden print:break-inside-avoid">
                  <button onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors print:pointer-events-none">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 print:text-gray-500 text-sm w-8">Q{i + 1}</span>
                      <span className="text-white print:text-black text-sm text-left flex-1">{r.question_text}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold ${getScoreColor(r.score || 0)} print:text-black`}>{r.score || 0}%</span>
                      <div className="print:hidden">
                        {expandedQ === i ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </div>
                  </button>
                  {/* Always show answers in print mode */}
                  <div className={`px-4 pb-4 border-t border-white/5 print:border-gray-100 ${expandedQ === i ? 'block' : 'hidden print:block'}`}>
                    <div className="mt-3 space-y-2">
                      <p className="text-gray-400 print:text-gray-500 text-xs uppercase tracking-wider">Your Answer</p>
                      <p className="text-gray-300 print:text-black text-sm bg-white/5 print:bg-gray-50 rounded-lg p-3">{r.answer_text || 'No answer'}</p>
                      <p className="text-gray-400 print:text-gray-500 text-xs uppercase tracking-wider mt-3">Feedback</p>
                      <p className="text-gray-300 print:text-black text-sm">{r.feedback || 'No feedback'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Behavioral Analysis */}
        {behavioralData && (
          <div className="mb-8 print:break-inside-avoid">
            <h2 className="text-xl font-bold text-white print:text-black mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-cyan-400 print:text-cyan-600" /> Behavioral Analysis
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 print:bg-white rounded-xl border border-white/10 print:border-gray-200 p-4 text-center">
                <p className="text-gray-400 print:text-gray-500 text-xs mb-1">Eye Contact</p>
                <p className="text-2xl font-bold text-cyan-400 print:text-black">{Math.round(behavioralData.avg_eye_contact || 0)}%</p>
              </div>
              <div className="bg-white/5 print:bg-white rounded-xl border border-white/10 print:border-gray-200 p-4 text-center">
                <p className="text-gray-400 print:text-gray-500 text-xs mb-1">Confidence</p>
                <p className="text-2xl font-bold text-purple-400 print:text-black">{Math.round(behavioralData.avg_confidence || 0)}%</p>
              </div>
              <div className="bg-white/5 print:bg-white rounded-xl border border-white/10 print:border-gray-200 p-4 text-center">
                <p className="text-gray-400 print:text-gray-500 text-xs mb-1">Emotion / Vibe</p>
                <p className="text-2xl font-bold text-indigo-400 print:text-black capitalize">{behavioralData.dominant_emotion || "Neutral"}</p>
              </div>
            </div>
          </div>
        )}

        {/* Proctoring Events */}
        {proctoringEvents.length > 0 && (
          <div className="mb-8 print:break-inside-avoid">
            <h2 className="text-xl font-bold text-white print:text-black mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400 print:text-yellow-600" /> Proctoring Log ({proctoringEvents.length} events)
            </h2>
            <div className="bg-white/5 print:bg-white rounded-xl border border-white/10 print:border-gray-200 p-4 space-y-2">
              {proctoringEvents.map((e: any, i: number) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-yellow-400 print:text-yellow-600">⚠</span>
                  <span className="text-gray-300 print:text-black capitalize">{e.type?.replace(/_/g, ' ')}</span>
                  <span className="text-gray-500 print:text-gray-400 ml-auto text-xs">{e.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="mb-8 print:break-inside-avoid">
            <h2 className="text-xl font-bold text-white print:text-black mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400 print:text-emerald-600" /> Learning Recommendations
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {recommendations.map((rec: any, i: number) => (
                <div key={i} className="bg-white/5 print:bg-white rounded-xl border border-white/10 print:border-gray-200 p-4 hover:bg-white/8 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-indigo-600/20 print:bg-indigo-50">
                      <Award className="w-4 h-4 text-indigo-400 print:text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white print:text-black font-medium text-sm truncate">{rec.title}</p>
                      <p className="text-gray-400 print:text-gray-600 text-xs mt-1">{rec.reason}</p>
                      {rec.url && (
                        <a href={rec.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-400 print:text-indigo-600 text-xs mt-2 hover:underline">
                          Open Resource <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    {rec.resource_type && (
                      <span className="px-2 py-0.5 rounded-full bg-white/5 print:bg-gray-100 text-gray-400 print:text-gray-600 text-xs capitalize flex-shrink-0">
                        {rec.resource_type}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportView;
