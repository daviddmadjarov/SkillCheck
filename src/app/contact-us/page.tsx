import { LegalPage } from '../legal-page';

export const metadata = {
  title: 'Contact Us | SkillCheck',
};

export default function ContactUsPage() {
  return (
    <LegalPage
      title="Contact Us"
      kicker="Support"
      intro="Got a question, found a bug, or need help with your account? Reach out via email and we will get back to you as soon as possible."
      lastUpdated="2026-06-13"
      sections={[
        {
          title: 'Email',
          body: [
            'All inquiries: marketcapgame@gmail.com',
            'This address covers general support, privacy/GDPR requests, and business or advertising questions.',
          ],
        },
        {
          title: 'What to include',
          body: [
            'For game or score issues: tell us the game name, what happened, and the username or email on your account.',
            'For privacy or data deletion requests: include the email address or username associated with your account so we can locate the record.',
            'For bug reports: describe the steps to reproduce the issue and include your browser and operating system if relevant.',
          ],
        },
      ]}
    />
  );
}