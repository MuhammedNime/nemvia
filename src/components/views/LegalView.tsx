import React, { useState } from 'react';
import { ShieldCheck, FileText } from 'lucide-react';

// ضع هنا بريد أو وسيلة التواصل الرسمية للمنصة (اختياري). إن بقي فارغاً يُطلب من المستخدم استخدام زر «إبلاغ».
const CONTACT = '';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-1.5">
    <h4 className="font-black text-slate-900 text-sm">{title}</h4>
    <div className="text-xs leading-relaxed text-slate-600 space-y-1.5">{children}</div>
  </section>
);

export const LegalContent: React.FC<{ tab: 'privacy' | 'terms' }> = ({ tab }) => {
  const contact = CONTACT ? `عبر ${CONTACT}` : 'عبر زر «إبلاغ» داخل المنصة أو بمراسلة إدارة المنصة';
  return tab === 'privacy' ? (
    <div className="space-y-4">
      <Section title="1. البيانات التي نجمعها">
        <p>الاسم الظاهر والبريد الإلكتروني وكلمة المرور (مشفّرة ولا نراها)، والمحتوى الذي تنشره (منشورات، تعليقات، رسائل، واجبات، ملفات)، ومعلومات الاستخدام الأساسية كالنقاط وأيام النشاط.</p>
      </Section>
      <Section title="2. كيف نستخدمها">
        <p>لتشغيل حسابك والصفوف والواجبات والاختبارات والمراسلة وإرسال الإشعارات، ولمراجعة البلاغات وحماية المجتمع. لا نبيع بياناتك ولا نشاركها لأغراض إعلانية.</p>
      </Section>
      <Section title="3. من يرى بياناتك">
        <p>اسمك وصورتك ونبذتك ظاهران للمستخدمين المسجّلين. المنشورات العامة يراها الجميع، والخاصة حسب إعدادك. معلّم الصف يرى تسليماتك ونتائجك. الرسائل الخاصة لا يراها إلا طرفاها، وقد تُراجع عند وجود بلاغ عنها.</p>
        <p>الملفات المرفوعة تُخزَّن بروابط عشوائية؛ من يملك الرابط المباشر يستطيع فتح الملف، فلا ترفع مستندات حساسة.</p>
      </Section>
      <Section title="4. التخزين والأمان">
        <p>تُحفظ البيانات لدى مزوّد الاستضافة والبيانات (Supabase) مع ضوابط وصول على مستوى الصفوف. لا يوجد نظام آمن بنسبة 100%، ونبذل جهدنا لحماية حسابك.</p>
      </Section>
      <Section title="5. الأطفال والقاصرون">
        <p>إن كنت دون السن القانوني في بلدك فاستخدم المنصة بإشراف وموافقة وليّ الأمر أو المدرسة. لا تشارك معلومات شخصية حساسة (عنوان، رقم هاتف) في أي محادثة.</p>
      </Section>
      <Section title="6. حقوقك">
        <p>يمكنك تعديل اسمك ونبذتك وخصوصية حسابك من «الملف الشخصي»، وحذف منشوراتك ورسائلك الجماعية. لطلب حذف حسابك أو بياناتك تواصل معنا {contact}.</p>
      </Section>
      <Section title="7. التحديثات">
        <p>قد نحدّث هذه السياسة، وسيظهر تاريخ آخر تحديث هنا. استمرارك في الاستخدام يعني موافقتك على النسخة الحالية.</p>
      </Section>
    </div>
  ) : (
    <div className="space-y-4">
      <Section title="1. القبول">
        <p>باستخدامك NEMVIA فأنت توافق على هذه الشروط. إن لم توافق فلا تستخدم المنصة.</p>
      </Section>
      <Section title="2. الحساب">
        <p>أنت مسؤول عن سرية كلمة مرورك وعن نشاط حسابك. استخدم معلومات صحيحة، وحساب واحد لكل شخص.</p>
      </Section>
      <Section title="3. قواعد السلوك">
        <p>يُمنع: الإساءة والتنمّر والتحرش، المحتوى الجنسي أو العنيف أو الكراهية، انتحال الشخصيات، السبام والاحتيال، نشر معلومات الآخرين الخاصة، الغش في الاختبارات، ورفع ملفات ضارة أو منتهكة لحقوق النشر.</p>
      </Section>
      <Section title="4. المحتوى">
        <p>تبقى ملكية ما تنشره لك، وتمنح المنصة ترخيصاً محدوداً لعرضه ضمن الخدمة. أنت مسؤول عن محتواك.</p>
      </Section>
      <Section title="5. الإبلاغ والإشراف">
        <p>يمكن لأي مستخدم الإبلاغ عن منشور أو تعليق أو رسالة. تراجع الإدارة البلاغات وقد تحذف المحتوى أو توقف الحساب (منع النشر والمراسلة) عند المخالفة، دون إشعار مسبق في الحالات الخطيرة.</p>
      </Section>
      <Section title="6. المعلمون">
        <p>المعلم مسؤول عن محتوى صفوفه وتقييمه لطلابه، ولا تتحمل المنصة مسؤولية الدرجات أو الشهادات الصادرة داخلها، فهي لأغراض تعليمية وتحفيزية.</p>
      </Section>
      <Section title="7. الحصص المباشرة والروابط الخارجية">
        <p>تعتمد الحصص على خدمات طرف ثالث (Jitsi / Google Meet) ولها شروطها الخاصة. لسنا مسؤولين عن محتوى الروابط الخارجية.</p>
      </Section>
      <Section title="8. إخلاء المسؤولية">
        <p>تُقدَّم الخدمة «كما هي» دون ضمانات، وقد تتوقف أو تتغير. لا نتحمل مسؤولية أضرار غير مباشرة ناتجة عن استخدامها.</p>
      </Section>
    </div>
  );
};

export const LegalView: React.FC = () => {
  const [tab, setTab] = useState<'privacy' | 'terms'>('privacy');
  return (
    <div className="space-y-5 animate-in fade-in max-w-3xl">
      <div>
        <h2 className="text-xl font-black text-slate-900">الخصوصية والشروط</h2>
        <p className="text-xs text-slate-500">آخر تحديث: 2026</p>
      </div>
      <div className="flex bg-slate-100 p-1 rounded-2xl text-sm font-bold w-fit">
        <button onClick={() => setTab('privacy')} className={`px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer ${tab === 'privacy' ? 'bg-white text-[#1677c7] shadow-xs' : 'text-slate-500'}`}>
          <ShieldCheck className="w-4 h-4" /> سياسة الخصوصية
        </button>
        <button onClick={() => setTab('terms')} className={`px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer ${tab === 'terms' ? 'bg-white text-[#1677c7] shadow-xs' : 'text-slate-500'}`}>
          <FileText className="w-4 h-4" /> شروط الاستخدام
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <LegalContent tab={tab} />
      </div>
    </div>
  );
};
