import React, { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Compass,
  Database,
  Dna,
  FileSpreadsheet,
  Globe2,
  Layers,
  Mail,
  Microscope,
  ShieldCheck,
  X,
} from 'lucide-react';

interface LandingPageProps {
  onNavigateLogin: () => void;
  onNavigateRegister: () => void;
}

type DocModalKind = 'documentation' | 'privacy' | 'terms' | null;

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigateLogin,
  onNavigateRegister,
}) => {
  const [modalKind, setModalKind] = useState<DocModalKind>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#F6FAF7] text-[#25332C] flex flex-col">
      {/* Top Bar: 3-zone contract */}
      <header className="sticky top-0 z-30 bg-[#F6FAF7]/95 backdrop-blur-sm border-b border-[#174D35]/12">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => scrollToSection('hero')}
            className="text-base lg:text-lg font-bold tracking-tight text-[#174D35] whitespace-nowrap shrink-0 text-left cursor-pointer"
          >
            eDNA Biodiversity Portal
          </button>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#25332C]/80">
            <button
              type="button"
              onClick={() => scrollToSection('hero')}
              className="hover:text-[#174D35] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('about')}
              className="hover:text-[#174D35] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              About
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="hover:text-[#174D35] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Features
            </button>
            <button
              type="button"
              onClick={() => setModalKind('documentation')}
              className="hover:text-[#174D35] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Documentation
            </button>
            <button
              type="button"
              onClick={onNavigateLogin}
              className="hover:text-[#174D35] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Login
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onNavigateRegister}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#174D35] hover:bg-[#269B68] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="hero" className="relative bg-[#14251D] text-white overflow-hidden">
        <div className="absolute inset-0">
          {!heroImgFailed ? (
            <img
              src="/src/assets/images/hero_edna_ecosystem_1795608859490.jpg"
              alt="Temperate rainforest stream flowing into coastal estuary supporting environmental DNA sampling"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="w-full h-full object-cover opacity-45"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#14251D] via-[#174D35] to-[#18A999]/40" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#14251D] via-[#14251D]/85 to-[#14251D]/45" />
        </div>

        <div className="relative max-w-[1440px] mx-auto px-6 lg:px-10 py-20 lg:py-28">
          <div className="max-w-3xl">
            <p className="text-xs font-mono tracking-wider uppercase text-[#18A999] mb-4">
              Environmental Genomics · Taxonomic Bioinformatics · Ecological Statistics
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight text-white [text-wrap:balance]">
              Identifying Taxonomy and Assessing Biodiversity from eDNA Datasets
            </h1>
            <p className="mt-5 text-base sm:text-lg text-white/85 leading-relaxed max-w-2xl">
              An integrated scientific platform for environmental DNA analysis, taxonomic
              identification, and biodiversity assessment.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onNavigateRegister}
                className="px-6 py-3 bg-[#269B68] hover:bg-[#18A999] text-white font-semibold text-sm rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onNavigateLogin}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/25 font-semibold text-sm rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('features')}
                className="px-5 py-3 text-white/90 hover:text-white underline underline-offset-4 text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                Explore Platform
              </button>
            </div>
          </div>

          {/* Quantitative workflow strip below hero copy */}
          <div className="mt-14 pt-8 border-t border-white/15 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-white/60">
                Supported Formats
              </div>
              <div className="mt-1 text-xl font-semibold font-mono tabular-nums text-white">
                FASTA · FASTQ · CSV · XLSX
              </div>
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-white/60">
                Target Markers
              </div>
              <div className="mt-1 text-xl font-semibold font-mono tabular-nums text-white">
                16S · 18S · COI · ITS · 12S
              </div>
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-white/60">
                Diversity Equations
              </div>
              <div className="mt-1 text-xl font-semibold font-mono tabular-nums text-white">
                Shannon · Simpson · Chao1 · PCoA
              </div>
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-white/60">
                Reporting Standards
              </div>
              <div className="mt-1 text-xl font-semibold font-mono tabular-nums text-white">
                PDF · Excel (.xlsx) · CSV
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About the Platform & eDNA Research */}
      <section id="about" className="py-16 lg:py-24 border-b border-[#174D35]/10">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-12 gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs font-mono uppercase tracking-wider text-[#18A999] mb-3">
                About the Platform
              </p>
              <h2 className="text-2xl lg:text-3xl font-bold text-[#174D35] tracking-tight [text-wrap:balance]">
                From Raw Environmental DNA Reads to Reproducible Ecological Intelligence
              </h2>
              <p className="mt-4 text-[#25332C]/85 leading-relaxed">
                Environmental DNA (eDNA) extracted from water, soil, sediment, and air captures trace
                genetic signatures of entire biological communities without invasive capture. This
                platform unifies dataset ingestion, quality filtering, marker-specific taxonomic
                assignment, alpha/beta biodiversity modeling, spatial GIS mapping, and publication-grade
                reporting in one structured workspace.
              </p>
              <div className="mt-8 grid sm:grid-cols-2 gap-6 pt-6 border-t border-[#174D35]/10">
                <div>
                  <h3 className="text-sm font-semibold text-[#174D35]">
                    Verified Reference Grounding
                  </h3>
                  <p className="mt-1.5 text-sm text-[#25332C]/75 leading-relaxed">
                    Sequence alignments run deterministically against curated marker vouchers or
                    researcher-supplied reference tables—never fabricated by generative models.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#174D35]">
                    Transparent Biostatistics
                  </h3>
                  <p className="mt-1.5 text-sm text-[#25332C]/75 leading-relaxed">
                    Every Shannon, Simpson, Pielou, Chao1, Bray-Curtis, and PCoA computation documents
                    its exact mathematical formula and input sample validation.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 grid sm:grid-cols-2 gap-4">
              <div className="rounded-xl overflow-hidden border border-[#174D35]/12 bg-white flex flex-col">
                <img
                  src="/src/assets/images/edna_sampling_field_1795608859214.jpg"
                  alt="Field biologist filtering river water for environmental DNA"
                  referrerPolicy="no-referrer"
                  className="w-full h-52 object-cover"
                />
                <div className="p-4">
                  <div className="text-xs font-mono text-[#18A999]">01 · Field Collection</div>
                  <div className="mt-1 text-sm font-semibold text-[#174D35]">
                    Georeferenced eDNA Sampling
                  </div>
                  <p className="mt-1 text-xs text-[#25332C]/75">
                    Capture GPS coordinates, water temperature, pH, salinity, and dissolved oxygen
                    alongside sample metadata.
                  </p>
                </div>
              </div>
              <div className="rounded-xl overflow-hidden border border-[#174D35]/12 bg-white flex flex-col">
                <img
                  src="/src/assets/images/edna_sequencing_lab_1795608859379.jpg"
                  alt="Genomics benchtop sequencer and laboratory pipettes"
                  referrerPolicy="no-referrer"
                  className="w-full h-52 object-cover"
                />
                <div className="p-4">
                  <div className="text-xs font-mono text-[#18A999]">02 · Laboratory Sequencing</div>
                  <div className="mt-1 text-sm font-semibold text-[#174D35]">
                    Amplicon & Sequence Ingestion
                  </div>
                  <p className="mt-1 text-xs text-[#25332C]/75">
                    Upload FASTA, FASTQ, CSV, TSV, Excel, or JSON datasets with automated GC% and Phred
                    quality screening.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Modules / Features */}
      <section id="features" className="py-16 lg:py-24 bg-white border-b border-[#174D35]/10">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-mono uppercase tracking-wider text-[#18A999] mb-2">
              Analytical Modules & Key Features
            </p>
            <h2 className="text-2xl lg:text-3xl font-bold text-[#174D35] tracking-tight">
              Built for Bioinformatics Rigor and Ecological Clarity
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl border border-[#174D35]/12 bg-[#F6FAF7]">
              <Database className="w-5 h-5 text-[#174D35]" />
              <h3 className="mt-4 text-base font-semibold text-[#174D35]">
                Dataset Analysis & Management
              </h3>
              <p className="mt-2 text-sm text-[#25332C]/80 leading-relaxed">
                Organize multi-site research projects, drag-and-drop FASTA/FASTQ/tabular files, inspect
                sequence quality metrics, and track processing status in PostgreSQL.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-[#174D35]/12 bg-[#F6FAF7]">
              <Dna className="w-5 h-5 text-[#174D35]" />
              <h3 className="mt-4 text-base font-semibold text-[#174D35]">
                Taxonomic Identification
              </h3>
              <p className="mt-2 text-sm text-[#25332C]/80 leading-relaxed">
                Configure markers (16S, 18S, COI, ITS, 12S, rbcL, matK), select reference repositories
                (SILVA, NCBI GenBank, BOLD, UNITE, MIDORI) or upload custom FASTA references.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-[#174D35]/12 bg-[#F6FAF7]">
              <BarChart3 className="w-5 h-5 text-[#174D35]" />
              <h3 className="mt-4 text-base font-semibold text-[#174D35]">
                Biodiversity Assessment
              </h3>
              <p className="mt-2 text-sm text-[#25332C]/80 leading-relaxed">
                Calculate Richness, Shannon-Wiener, Simpson, Pielou evenness, Chao1, Bray-Curtis and
                Jaccard dissimilarity heatmaps, and Principal Coordinate Analysis (PCoA).
              </p>
            </div>

            <div className="p-6 rounded-xl border border-[#174D35]/12 bg-[#F6FAF7]">
              <Globe2 className="w-5 h-5 text-[#174D35]" />
              <h3 className="mt-4 text-base font-semibold text-[#174D35]">
                Geographical Biodiversity Map
              </h3>
              <p className="mt-2 text-sm text-[#25332C]/80 leading-relaxed">
                Interactive Leaflet spatial explorer filtering sites by country, region, sample type,
                and collection date with sample-specific taxonomic compositions.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-[#174D35]/12 bg-[#F6FAF7]">
              <Microscope className="w-5 h-5 text-[#174D35]" />
              <h3 className="mt-4 text-base font-semibold text-[#174D35]">
                AI Biodiversity Research Assistant
              </h3>
              <p className="mt-2 text-sm text-[#25332C]/80 leading-relaxed">
                Powered by Google Gemini to interpret verified taxonomic and diversity outputs, explain
                indices, compare sites, and draft report sections without fabricating species.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-[#174D35]/12 bg-[#F6FAF7]">
              <FileSpreadsheet className="w-5 h-5 text-[#174D35]" />
              <h3 className="mt-4 text-base font-semibold text-[#174D35]">
                Scientific Report Generation
              </h3>
              <p className="mt-2 text-sm text-[#25332C]/80 leading-relaxed">
                Export structured multi-section reports in PDF, multi-sheet Excel (.xlsx), CSV, or
                print-ready layouts stamped with analysis date and engine version.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Research Applications */}
      <section className="py-16 lg:py-24 border-b border-[#174D35]/10">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5 rounded-xl overflow-hidden border border-[#174D35]/12 bg-white">
            <img
              src="/src/assets/images/aquatic_biodiversity_ecosystem_1795608859384.jpg"
              alt="Freshwater and coastal aquatic biodiversity habitat"
              referrerPolicy="no-referrer"
              className="w-full h-80 object-cover"
            />
          </div>
          <div className="lg:col-span-7">
            <p className="text-xs font-mono uppercase tracking-wider text-[#18A999] mb-2">
              eDNA Research and Applications
            </p>
            <h2 className="text-2xl lg:text-3xl font-bold text-[#174D35] tracking-tight">
              Supporting Ecological Conservation, Academic Research & Monitoring
            </h2>
            <div className="mt-6 grid sm:grid-cols-2 gap-6">
              <div className="flex gap-3">
                <Compass className="w-5 h-5 text-[#269B68] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-[#174D35]">
                    Freshwater & Marine Bioassessment
                  </h3>
                  <p className="mt-1 text-sm text-[#25332C]/80">
                    Detect elusive fish, macroinvertebrates, and benthic taxa using 12S and COI
                    metabarcoding across watersheds and estuaries.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Layers className="w-5 h-5 text-[#269B68] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-[#174D35]">
                    Microbial & Soil Ecology
                  </h3>
                  <p className="mt-1 text-sm text-[#25332C]/80">
                    Profile bacterial (16S rRNA) and fungal (ITS) community turnover across forest
                    gradients and restoration plots.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <BookOpen className="w-5 h-5 text-[#269B68] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-[#174D35]">
                    University Teaching & Thesis Labs
                  </h3>
                  <p className="mt-1 text-sm text-[#25332C]/80">
                    Structured workflows help students and research scholars trace raw sequences to
                    statistically valid biodiversity conclusions.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <ShieldCheck className="w-5 h-5 text-[#269B68] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-[#174D35]">
                    Environmental Impact Baselines
                  </h3>
                  <p className="mt-1 text-sm text-[#25332C]/80">
                    Generate auditable Excel and PDF biodiversity baselines for environmental
                    consultants and regulatory monitoring teams.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Information */}
      <section id="contact" className="py-14 bg-white border-b border-[#174D35]/10">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-[#18A999] mb-1">
              Contact Information
            </p>
            <h2 className="text-xl font-bold text-[#174D35]">
              Collaborate with the Environmental Genomics Research Team
            </h2>
            <p className="mt-1 text-sm text-[#25332C]/80">
              For institutional onboarding, reference database integration, or methodological inquiries.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-[#174D35] font-medium">
              <Mail className="w-4 h-4 text-[#269B68]" />
              <span>research-support@edna-biodiversity.org</span>
            </div>
            <button
              type="button"
              onClick={onNavigateRegister}
              className="px-4 py-2 bg-[#174D35] hover:bg-[#269B68] text-white font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Create Researcher Account
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#14251D] text-white/80 py-10 mt-auto">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="font-display font-semibold text-white">
              Identifying Taxonomy and Assessing Biodiversity from eDNA Datasets
            </div>
            <div className="mt-1 text-xs text-white/60">
              © {new Date().getFullYear()} Environmental DNA Biodiversity Research Platform. All
              scientific calculations follow reproducible ecological standards.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs font-medium">
            <button
              type="button"
              onClick={() => scrollToSection('about')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              About
            </button>
            <button
              type="button"
              onClick={() => setModalKind('documentation')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Documentation
            </button>
            <button
              type="button"
              onClick={() => setModalKind('privacy')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => setModalKind('terms')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Terms and Conditions
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('contact')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Contact
            </button>
          </div>
        </div>
      </footer>

      {/* Documentation / Policy Modal */}
      {modalKind && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#174D35]/15 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-[#174D35]/12 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#174D35]">
                {modalKind === 'documentation'
                  ? 'Platform Scientific Documentation'
                  : modalKind === 'privacy'
                    ? 'Privacy Policy'
                    : 'Terms and Conditions'}
              </h3>
              <button
                type="button"
                onClick={() => setModalKind(null)}
                className="p-1.5 text-[#25332C]/70 hover:text-[#174D35] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-sm text-[#25332C]/85 space-y-4 leading-relaxed">
              {modalKind === 'documentation' && (
                <>
                  <p>
                    <strong>1. Supported Dataset Formats:</strong> Upload FASTA (.fasta, .fa), FASTQ
                    (.fastq, .fq), CSV (.csv), TSV (.tsv), Excel (.xlsx), or JSON (.json) files up to
                    25 MB. Delimited tables may include sequence data or pre-validated taxonomic
                    abundance columns.
                  </p>
                  <p>
                    <strong>2. Taxonomic Identification Engine:</strong> Sequence records are screened
                    for length and ambiguous base content, then matched via deterministic k-mer
                    containment and optimal sequence alignment against curated marker voucher
                    repositories (16S rRNA, 18S rRNA, COI, ITS, 12S rRNA, rbcL, matK) or a
                    researcher-uploaded reference FASTA. Sequences failing thresholds are marked
                    unassigned rather than inferred.
                  </p>
                  <p>
                    <strong>3. Biodiversity Equations:</strong> Alpha diversity computes Observed
                    Richness (S), Shannon-Wiener (H&apos;), unbiased Simpson (1-D), Pielou evenness
                    (J&apos;), and bias-corrected Chao1. Beta diversity computes Bray-Curtis and Jaccard
                    matrices plus classical Principal Coordinate Analysis (PCoA).
                  </p>
                  <p>
                    <strong>4. AI Research Assistant Boundary:</strong> The Gemini Research Assistant
                    interprets only verified database outputs and clearly separates computed facts
                    from ecological commentary.
                  </p>
                </>
              )}
              {modalKind === 'privacy' && (
                <>
                  <p>
                    Researcher profile metadata, authentication tokens, and uploaded eDNA datasets are
                    isolated per authenticated account using server-side ownership checks and encrypted
                    transport (TLS).
                  </p>
                  <p>
                    Uploaded biological sequences and taxonomic assignments remain private to your
                    researcher account unless explicitly exported by you into PDF, Excel, or CSV
                    reports.
                  </p>
                </>
              )}
              {modalKind === 'terms' && (
                <>
                  <p>
                    This platform is provided for academic, environmental conservation, and scientific
                    research analysis. Researchers are responsible for verifying primer specificity,
                    field contamination controls, and external voucher validation prior to regulatory
                    submission.
                  </p>
                  <p>
                    Automated account creation is restricted to standard researcher roles. Unauthorized
                    attempts to probe or elevate system privileges are logged and audited.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
