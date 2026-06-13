import { LegalPage } from '../legal-page';

export const metadata = {
  title: 'Imprint | SkillCheck',
};

export default function ImprintPage() {
  return (
    <LegalPage
      title="Imprint / Impressum"
      kicker="Legal Notice"
      intro="Information about the operator of skillcheck.online, provided in accordance with §5 ECG (Austrian E-Commerce Act) and §25 MedienG (Austrian Media Act)."
      lastUpdated="2026-06-13"
      sections={[
        {
          title: 'Operator',
          body: [
            'David Madjarov',
            'Schenkendorfgasse 17/11, 1210 Wien, Austria',
            'This website is operated by a private individual and not a registered commercial entity.',
          ],
        },
        {
          title: 'Contact',
          body: [
            'Email: marketcapgame@gmail.com',
            'Responsible for the content of this website: David Madjarov.',
          ],
        },
        {
          title: 'Online Dispute Resolution',
          body: [
            'The European Commission provides an online dispute resolution platform: https://ec.europa.eu/consumers/odr',
            'We are not obliged to participate in alternative dispute resolution procedures before a consumer arbitration board, but are generally willing to do so.',
          ],
        },
        {
          title: 'Copyright',
          body: [
            'All content, visuals, game logic, and branding on skillcheck.online are owned by the operator unless otherwise noted.',
            'Third-party assets, fonts, and libraries remain subject to their respective licenses.',
            'Reproduction or redistribution of site content without prior written permission is prohibited.',
          ],
        },
      ]}
    />
  );
}