import { useState } from "react";
import { Ban, ShieldCheck } from "lucide-react";

const ELIGIBILITY_KEY = "veyl.eligibility.v1";
const TERMS_VERSION = 1;

export function readEligibility(): boolean {
  try {
    const raw = window.localStorage.getItem(ELIGIBILITY_KEY);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return false;
    const record = parsed as { version?: unknown; accepted?: unknown };
    return record.version === TERMS_VERSION && record.accepted === true;
  } catch {
    return false;
  }
}

export function markEligibility(): void {
  try {
    window.localStorage.setItem(
      ELIGIBILITY_KEY,
      JSON.stringify({ version: TERMS_VERSION, accepted: true, ts: Date.now() }),
    );
  } catch {
    /* storage unavailable; the screen will re-appear next visit */
  }
}

function BrandRow() {
  return (
    <div className="gate-brand" aria-hidden="true">
      <img
        src={`${import.meta.env.BASE_URL}veyl-mark.png`}
        alt=""
        width={62}
        height={80}
        className="gate-mark"
      />
      <span className="gate-word">eyl</span>
    </div>
  );
}

function TermsBody() {
  return (
    <>
      <section className="gate-section">
        <h2>1. What Veyl is</h2>
        <p>
          Veyl is an app for trading tokenized stocks (bStocks), quoted in USD and settled in
          USDT on BNB Smart Chain. Orders are routed through the Binance Web3 Trading
          API and executed against third-party liquidity venues with your own wallet in Nimiq Pay.
          Veyl creates no accounts, holds no private keys, custodies no funds and executes nothing
          on your behalf. Every transaction requires your wallet’s
          signature and is final once broadcast.
        </p>
      </section>

      <section className="gate-section">
        <h2>2. Not financial advice</h2>
        <p>
          Nothing in the application, its displays, or its documentation is investment, legal, tax
          or accounting advice, and nothing is a recommendation or solicitation to buy or sell any
          asset. Prices, on-chain statistics and quotes are informational, are sourced from third
          parties, and may be delayed, estimated or inaccurate. You make your own decisions and bear
          your own outcomes.
        </p>
      </section>

      <section className="gate-section">
        <h2>3. Risks</h2>
        <p>Using tokenized assets carries substantial risk, including:</p>
        <ul>
          <li>
            <strong>Market risk:</strong> token prices can move sharply, including to zero.
          </li>
          <li>
            <strong>Reference price risk:</strong> a bStock tracks an external reference price that
            can diverge from its on-chain price, especially when the underlying market is closed.
          </li>
          <li>
            <strong>Liquidity risk:</strong> quotes can widen or disappear, and exits can be slow
            when markets move.
          </li>
          <li>
            <strong>Protocol risk:</strong> smart contracts can contain bugs, be exploited, or
            behave unexpectedly.
          </li>
          <li>
            <strong>Regulatory risk:</strong> the availability and legality of tokenized equities
            can change in your jurisdiction at any time.
          </li>
          <li>
            <strong>Dependency risk:</strong> quotes, balances and broadcast infrastructure depend
            on third-party APIs, RPC nodes, the Binance Web3 API and Nimiq Pay, all of which can be
            unavailable.
          </li>
          <li>
            <strong>Wallet and key risk:</strong> lost keys, lost devices and signing malicious
            transactions are your responsibility. Transactions cannot be reversed.
          </li>
        </ul>
      </section>

      <section className="gate-section">
        <h2>4. Tokenized stocks</h2>
        <p>
          bStocks are tokens issued by third parties that reference the price of a listed equity.{" "}
          <strong>They are not shares.</strong> Unless the issuer’s documentation says otherwise,
          holding a bStock does not grant shareholder, voting, or dividend rights. Issuer, custody,
          redemption, fee and eligibility terms are set by the issuer and are outside Veyl’s
          control. Read the issuer’s offering documents before you trade. The bStock can transfer
          around the clock on-chain while the underlying market is closed.
        </p>
      </section>

      <section className="gate-section">
        <h2>5. Fees and costs</h2>
        <p>
          Veyl charges no fee for using the application. Every transaction you sign costs network
          gas in BNB. Venue and protocol fees are embedded in the quotes you receive and are shown
          before you confirm. Third parties may change their fees at any time.
        </p>
      </section>

      <section className="gate-section gate-section-key">
        <h2>6. Eligibility and restricted jurisdictions</h2>
        <p>
          You must be at least 18 years old, and you may not use Veyl if applicable law, sanctions
          or embargoes prohibit it. You are solely responsible for determining whether tokenized
          equities are lawful for you where you live.
        </p>
        <p>
          In particular, you may <strong>not</strong> use Veyl if you are any of the following, or
          are acting for or on behalf of any of the following:
        </p>
        <ul>
          <li>
            a citizen, resident, national or tax resident of the United States of America or of any
            of its territories or possessions, including Guam, Puerto Rico, the US Virgin Islands,
            American Samoa and the Northern Mariana Islands;
          </li>
          <li>
            a person located in, or incorporated or formed in, a Restricted Jurisdiction: the United
            States and its territories, Cuba, Iran, North Korea, Syria, and any jurisdiction subject
            to comprehensive sanctions imposed by the United States Office of Foreign Assets Control
            (OFAC);
          </li>
          <li>a person for whom transacting in bStocks is otherwise prohibited by sanctions or embargoes;</li>
          <li>
            an entity, trust or estate owned, controlled or beneficially owned by any of the
            foregoing.
          </li>
        </ul>
        <p>
          Veyl may use technical measures, including IP-based geolocation, to block or limit access
          from Restricted Jurisdictions and may terminate access if a violation is detected.
          Misrepresenting your eligibility voids this agreement and any rights under it.
        </p>
      </section>

      <section className="gate-section">
        <h2>7. Third-party services</h2>
        <p>
          Veyl depends on third parties it does not control: the Binance Web3 Trading API, bStock
          issuers and custodians, public blockchain RPC endpoints, explorers, and your wallet
          provider. They are not party to these terms and are responsible only for their own
          services and terms.
        </p>
      </section>

      <section className="gate-section">
        <h2>8. No warranties</h2>
        <p>
          The application is provided “as is” and “as available”, without warranties of any kind,
          express or implied, including merchantability, fitness for a particular purpose and
          non-infringement. We do not warrant that the application will be uninterrupted, accurate,
          error-free or secure.
        </p>
      </section>

      <section className="gate-section">
        <h2>9. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, Veyl and its contributors will not be liable for
          indirect, incidental, special, consequential or punitive damages, or loss of profits,
          digital assets or data, arising from your use of the application. Where liability cannot
          be excluded, it is limited to the amounts you paid to use the application, which is zero
          while no fee is charged.
        </p>
      </section>

      <section className="gate-section">
        <h2>10. Changes to these terms</h2>
        <p>
          These terms may be updated. The eligibility screen is shown again when the terms change.
          Continued use after an update constitutes acceptance of the revised terms.
        </p>
      </section>

      <section className="gate-section">
        <h2>11. Contact</h2>
        <p>
          Questions about these terms can be raised with whoever provided you this application.
        </p>
      </section>
    </>
  );
}

function Blocked({ reason }: { reason: "region" | "declined" }) {
  return (
    <div className="gate">
      <span className="dots-backdrop" aria-hidden="true" />
      <div className="gate-blocked">
        <span className="gate-blocked-icon" aria-hidden="true">
          <Ban size={26} strokeWidth={1.8} />
        </span>
        <h1>Veyl is not available to you</h1>
        <p className="gate-blocked-lead">
          {reason === "region"
            ? "Access from your location is blocked because tokenized stocks are not offered to US persons or residents of Restricted Jurisdictions."
            : "You declined the Terms and Conditions, which include the US and Restricted Jurisdiction eligibility requirement."}
        </p>
        <p className="gate-blocked-note">
          Veyl offers bStocks, which are not offered to US persons or to residents of Restricted
          Jurisdictions. If you believe this is an error, you may close this page. Declining or
          bypassing this notice does not entitle you to use the application.
        </p>
      </div>
    </div>
  );
}

export function RegionBlocked() {
  return <Blocked reason="region" />;
}

export function EligibilityGate({ onAccept }: { onAccept: () => void }) {
  const [declined, setDeclined] = useState(false);
  const [confirmEligibility, setConfirmEligibility] = useState(false);
  const [confirmTerms, setConfirmTerms] = useState(false);
  const ready = confirmEligibility && confirmTerms;

  if (declined) return <Blocked reason="declined" />;

  return (
    <div className="gate">
      <span className="dots-backdrop" aria-hidden="true" />
      <div className="gate-inner">
        <BrandRow />
        <div
          className="card gate-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gate-title"
        >
          <div className="gate-head">
            <span className="gate-head-icon" aria-hidden="true">
              <ShieldCheck size={20} strokeWidth={1.8} />
            </span>
            <div>
              <h1 id="gate-title">Terms and conditions</h1>
              <p className="gate-updated">Last updated November 2026</p>
            </div>
          </div>

          <div className="gate-body" tabIndex={0} aria-label="Terms and conditions (scrollable)">
            <TermsBody />
          </div>

          <label className="gate-check" data-checked={confirmEligibility}>
            <input
              type="checkbox"
              checked={confirmEligibility}
              onChange={(event) => setConfirmEligibility(event.target.checked)}
            />
            <span>
              I confirm that I am not a citizen, resident, national or tax resident of the United
              States or any of its territories, and I am not located in, nor am I acting on behalf
              of, anyone located in a Restricted Jurisdiction as defined in Section 6.
            </span>
          </label>

          <label className="gate-check" data-checked={confirmTerms}>
            <input
              type="checkbox"
              checked={confirmTerms}
              onChange={(event) => setConfirmTerms(event.target.checked)}
            />
            <span>
              I have read and agree to these Terms and Conditions, including the risk disclosures
              and Section 6.
            </span>
          </label>

          <div className="gate-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setDeclined(true)}>
              Decline
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={!ready}
              onClick={onAccept}
            >
              I agree and enter Veyl
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
