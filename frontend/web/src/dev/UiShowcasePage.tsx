import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Download,
  FileSpreadsheet,
  Inbox,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings,
  Trash2,
  User,
} from 'lucide-react';
import { changeLanguage, DEFAULT_LANGUAGE, isSupportedLanguage, SUPPORTED_LANGUAGES } from '@/i18n';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  IconButton,
  LoadingScreen,
  Modal,
  ModalClose,
  Select,
  Spinner,
  TextField,
  Tooltip,
} from '@/components/ui';
import { UI_SHOWCASE_COPY } from './uiShowcaseCopy';
import styles from './UiShowcasePage.module.css';

// Inline SVG so the demo avatar never depends on the network
const SAMPLE_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#fcd34d"/><circle cx="40" cy="32" r="14" fill="#92400e"/><rect x="16" y="52" width="48" height="28" rx="14" fill="#92400e"/></svg>'
  );

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const id = `section-${title.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <section aria-labelledby={id} className={styles.section}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      {children}
    </section>
  );
};

const Row: React.FC<{ label?: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className={styles.row}>
    {label && <p className={styles.rowLabel}>{label}</p>}
    <div className={styles.rowItems}>{children}</div>
  </div>
);

/** Development-only catalogue of every UI component, variant and state (route: /dev/ui). */
export const UiShowcasePage: React.FC = () => {
  const { i18n } = useTranslation();
  const lang = isSupportedLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;
  const c = UI_SHOWCASE_COPY[lang];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [lastMenuAction, setLastMenuAction] = useState<string | null>(null);

  useEffect(() => {
    if (!showLoadingScreen) return;
    const timer = window.setTimeout(() => setShowLoadingScreen(false), 3000);
    return () => window.clearTimeout(timer);
  }, [showLoadingScreen]);

  if (showLoadingScreen) {
    return <LoadingScreen message={c.loadingScreenMessage} />;
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{c.pageTitle}</h1>
          <p className={styles.intro}>{c.pageIntro}</p>
        </div>
        <div role="group" aria-label={c.language} className={styles.languageSwitch}>
          {SUPPORTED_LANGUAGES.map((code) => (
            <Button
              key={code}
              variant={code === lang ? 'primary' : 'secondary'}
              aria-pressed={code === lang}
              onClick={() => void changeLanguage(code)}
            >
              {code.toUpperCase()}
            </Button>
          ))}
        </div>
      </header>

      <Section title={c.sections.button}>
        <p className={styles.note}>{c.states.hoverHint}</p>
        <Row label={c.states.default}>
          <Button variant="primary">{c.button.primary}</Button>
          <Button variant="secondary">{c.button.secondary}</Button>
          <Button variant="ghost">{c.button.ghost}</Button>
          <Button variant="danger">{c.button.danger}</Button>
        </Row>
        <Row label={c.states.large}>
          <Button size="lg">{c.button.next}</Button>
          <Button size="lg" variant="secondary">
            {c.button.secondary}
          </Button>
        </Row>
        <Row label={c.states.withIcons}>
          <Button leftIcon={<Plus />}>{c.button.primary}</Button>
          <Button variant="secondary" leftIcon={<FileSpreadsheet />}>
            {c.button.secondary}
          </Button>
          <Button variant="ghost" rightIcon={<ArrowRight />}>
            {c.button.ghost}
          </Button>
        </Row>
        <Row label={c.states.disabled}>
          <Button disabled>{c.button.primary}</Button>
          <Button variant="secondary" disabled>
            {c.button.secondary}
          </Button>
          <Button variant="ghost" disabled>
            {c.button.ghost}
          </Button>
          <Button variant="danger" disabled>
            {c.button.danger}
          </Button>
        </Row>
        <Row label={c.states.loading}>
          <Button isLoading>{c.button.save}</Button>
          <Button variant="secondary" isLoading>
            {c.button.save}
          </Button>
          <Button variant="danger" isLoading>
            {c.button.danger}
          </Button>
        </Row>
        <Row label={c.states.fullWidth}>
          <div className={styles.narrow}>
            <Button size="lg" fullWidth>
              {c.button.next}
            </Button>
          </div>
        </Row>
      </Section>

      <Section title={c.sections.iconButton}>
        <Row label={c.states.default}>
          <IconButton aria-label={c.iconButton.edit} icon={<Pencil />} />
          <IconButton
            aria-label={c.iconButton.more}
            icon={<MoreHorizontal />}
            variant="secondary"
          />
          <IconButton aria-label={c.iconButton.delete} icon={<Trash2 />} variant="danger" />
          <IconButton aria-label={c.iconButton.edit} icon={<Plus />} variant="primary" size="lg" />
        </Row>
        <Row label={`${c.states.disabled} / ${c.states.loading}`}>
          <IconButton aria-label={c.iconButton.edit} icon={<Pencil />} disabled />
          <IconButton aria-label={c.iconButton.delete} icon={<Trash2 />} isLoading />
        </Row>
      </Section>

      <Section title={c.sections.textField}>
        <div className={styles.formGrid}>
          <TextField
            label={c.textField.fullName}
            placeholder={c.textField.fullNamePlaceholder}
            required
          />
          <TextField label={c.textField.email} type="email" helperText={c.textField.emailHelper} />
          <TextField
            label={c.textField.email}
            type="email"
            defaultValue="invalid-email"
            error={c.textField.emailError}
            required
          />
          <TextField
            label={c.textField.password}
            type="password"
            defaultValue="learnup-2026"
            helperText={c.textField.passwordHelper}
            required
          />
          <TextField
            label={c.textField.disabled}
            helperText={c.textField.disabledHelper}
            defaultValue="0123456789"
            disabled
          />
        </div>
      </Section>

      <Section title={c.sections.select}>
        <div className={styles.formGrid}>
          <Select label={c.select.status} placeholder={c.select.placeholder} defaultValue="">
            {c.select.options.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </Select>
          <Select
            label={c.select.status}
            placeholder={c.select.placeholder}
            defaultValue=""
            error={c.select.error}
            required
          >
            {c.select.options.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </Select>
          <Select label={c.select.disabled} disabled>
            {c.select.options.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </Select>
        </div>
      </Section>

      <Section title={c.sections.checkbox}>
        <div className={styles.stack}>
          <Checkbox label={c.checkbox.notify} helperText={c.checkbox.notifyHelper} defaultChecked />
          <Checkbox label={c.checkbox.terms} error={c.checkbox.termsError} required />
          <Checkbox label={c.checkbox.disabled} helperText={c.checkbox.disabledHelper} disabled />
        </div>
      </Section>

      <Section title={c.sections.alert}>
        <div className={styles.stack}>
          <Alert tone="info" title={c.alert.infoTitle}>
            {c.alert.infoBody}
          </Alert>
          <Alert tone="success" title={c.alert.successTitle}>
            {c.alert.successBody}
          </Alert>
          <Alert tone="warning" title={c.alert.warningTitle}>
            {c.alert.warningBody}
          </Alert>
          <Alert tone="danger" title={c.alert.dangerTitle}>
            {c.alert.dangerBody}
          </Alert>
        </div>
      </Section>

      <Section title={c.sections.badge}>
        <Row>
          <Badge tone="neutral">{c.badge.neutral}</Badge>
          <Badge tone="info">{c.badge.info}</Badge>
          <Badge tone="success">{c.badge.success}</Badge>
          <Badge tone="warning">{c.badge.warning}</Badge>
          <Badge tone="danger">{c.badge.danger}</Badge>
        </Row>
      </Section>

      <Section title={c.sections.card}>
        <div className={styles.cardGrid}>
          <Card>
            <h3 className={styles.cardTitle}>{c.card.title}</h3>
            <p className={styles.note}>{c.card.body}</p>
          </Card>
          <Card padding="lg">
            <h3 className={styles.cardTitle}>{c.card.title}</h3>
            <p className={styles.note}>{c.card.body}</p>
          </Card>
        </div>
      </Section>

      <Section title={c.sections.spinner}>
        <Row>
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" label={c.spinner.custom} />
          <Button variant="secondary" onClick={() => setShowLoadingScreen(true)}>
            {c.showLoadingScreen}
          </Button>
        </Row>
      </Section>

      <Section title={c.sections.emptyState}>
        <Card>
          <EmptyState
            icon={<Inbox />}
            title={c.emptyState.title}
            description={c.emptyState.description}
            action={<Button variant="secondary">{c.emptyState.action}</Button>}
            headingLevel={3}
          />
        </Card>
      </Section>

      <Section title={c.sections.avatar}>
        <Row>
          <Avatar name={c.avatar.withImage} src={SAMPLE_AVATAR} size="lg" />
          <Avatar name={c.avatar.initials} size="lg" />
          <Avatar name={c.avatar.initials} />
          <Avatar name={c.avatar.single} size="sm" />
          <Avatar name={c.avatar.broken} src="/does-not-exist.png" />
        </Row>
      </Section>

      <Section title={c.sections.modal}>
        <Row>
          <Modal
            open={isModalOpen}
            onOpenChange={setIsModalOpen}
            trigger={<Button variant="secondary">{c.modal.open}</Button>}
            title={c.modal.title}
            description={c.modal.description}
            footer={
              <>
                <ModalClose asChild>
                  <Button variant="secondary">{c.modal.cancel}</Button>
                </ModalClose>
                <Button variant="danger" onClick={() => setIsModalOpen(false)}>
                  {c.modal.confirm}
                </Button>
              </>
            }
          >
            <p className={styles.note}>{c.modal.body}</p>
          </Modal>
        </Row>
      </Section>

      <Section title={c.sections.dropdownMenu}>
        <Row>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" leftIcon={<User />}>
                {c.dropdownMenu.trigger}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>{c.dropdownMenu.label}</DropdownMenuLabel>
              <DropdownMenuItem
                icon={<User />}
                onSelect={() => setLastMenuAction(c.dropdownMenu.profile)}
              >
                {c.dropdownMenu.profile}
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={<Settings />}
                onSelect={() => setLastMenuAction(c.dropdownMenu.settings)}
              >
                {c.dropdownMenu.settings}
              </DropdownMenuItem>
              <DropdownMenuItem disabled>{c.dropdownMenu.disabled}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                icon={<LogOut />}
                tone="danger"
                onSelect={() => setLastMenuAction(c.dropdownMenu.signOut)}
              >
                {c.dropdownMenu.signOut}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {lastMenuAction && (
            <p role="status" className={styles.note}>
              {`${c.dropdownMenu.selected}: ${lastMenuAction}`}
            </p>
          )}
        </Row>
      </Section>

      <Section title={c.sections.tooltip}>
        <Row>
          <Tooltip content={c.tooltip.content}>
            <IconButton aria-label={c.tooltip.trigger} icon={<Download />} variant="secondary" />
          </Tooltip>
          <Tooltip content={c.tooltip.content} side="right">
            <Button variant="ghost">{c.tooltip.trigger}</Button>
          </Tooltip>
        </Row>
      </Section>
    </main>
  );
};
