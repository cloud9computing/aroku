import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Person, DocumentRecord, Medication, Visit, CareTeamMember, AppNotification } from './types';
import { subscribeToAuthState, ensureUserProfile, syncFamilyClaim, UserProfile } from './firebase/auth';
import { Family, subscribeToFamily } from './firebase/family';
import {
  subscribePeople,
  addPerson,
  subscribeRecords,
  addRecord,
  updateRecord,
  verifyFactInRecord,
  deleteRecord,
  subscribeMedications,
  addMedication,
  updateMedication,
  deleteMedication,
  subscribeVisits,
  addVisit,
  updateVisit,
  deleteVisit,
  subscribeCareTeam,
  addCareTeamMember,
  updateCareTeamMember,
  deleteCareTeamMember,
  subscribeNotifications,
  markNotificationRead,
} from './firebase/firestoreService';
import { SignInScreen } from './components/auth/SignInScreen';
import { FamilyOnboarding } from './components/auth/FamilyOnboarding';
import { Header } from './components/common/Header';
import { BottomNav, TabType } from './components/common/BottomNav';
import { AssistantBar } from './components/common/AssistantBar';
import { PersonSwitcherModal } from './components/common/PersonSwitcherModal';
import { AddPersonModal } from './components/common/AddPersonModal';
import { NotificationsModal } from './components/common/NotificationsModal';
import { HouseholdModal } from './components/common/HouseholdModal';
import { AssistantDrawer } from './components/assistant/AssistantDrawer';
import { CaptureModal } from './components/capture/CaptureModal';
import { RecordsTab } from './components/records/RecordsTab';
import { MedicinesTab } from './components/medicines/MedicinesTab';
import { VisitsTab } from './components/visits/VisitsTab';
import { DoctorsTab } from './components/doctors/DoctorsTab';
import { ChatMessage, processAssistantQuery } from './services/assistantEngine';
import { ChatHistoryEntry } from './services/gemini';
import { useVirtualKeyboard } from './hooks/useVirtualKeyboard';
import { LoadingScreen } from './components/common/LoadingScreen';
import { IconUsers } from '@tabler/icons-react';

export const App: React.FC = () => {
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [isClaimSynced, setIsClaimSynced] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [people, setPeople] = useState<Person[]>([]);
  const [currentPersonId, setCurrentPersonId] = useState<string | null>(null);
  const [records, setRecords] = useState<DocumentRecord[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [careTeam, setCareTeam] = useState<CareTeamMember[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('records');

  const { isKeyboardVisible } = useVirtualKeyboard();

  const [isPersonSwitcherOpen, setIsPersonSwitcherOpen] = useState(false);
  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isHouseholdOpen, setIsHouseholdOpen] = useState(false);
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);

  const [assistantMessages, setAssistantMessages] = useState<ChatMessage[]>([]);
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const [isAssistantDrawerOpen, setIsAssistantDrawerOpen] = useState(false);

  // Auth
  useEffect(() => subscribeToAuthState(setAuthUser), []);

  useEffect(() => {
    if (authUser === undefined) return;
    if (authUser === null) {
      setUserProfile(null);
      return;
    }
    ensureUserProfile(authUser)
      .then(setUserProfile)
      .catch((err) => {
        console.error('Failed to load user profile:', err);
        setLoadError('Could not load your profile. Check your connection and reload.');
      });
  }, [authUser]);

  // Family
  useEffect(() => {
    if (!userProfile?.familyId) {
      setFamily(null);
      return;
    }
    return subscribeToFamily(userProfile.familyId, setFamily, () => {
      setLoadError('Could not load your family data. Check your connection and reload.');
    });
  }, [userProfile?.familyId]);

  // Storage rules check a familyId claim baked into the Auth token, not a
  // Firestore lookup — keep it in sync and wait for the refreshed token before
  // showing screens that upload to Storage (capture, consultation recording).
  useEffect(() => {
    if (!userProfile?.familyId) {
      setIsClaimSynced(false);
      return;
    }
    setIsClaimSynced(false);
    syncFamilyClaim()
      .catch((err) => console.error('Failed to sync family claim:', err))
      .finally(() => setIsClaimSynced(true));
  }, [userProfile?.familyId]);

  // People — live for the whole family
  useEffect(() => {
    if (!family) return;
    return subscribePeople(family.id, (all) => {
      setPeople(all);
      setCurrentPersonId((prev) => (prev && all.some((p) => p.id === prev) ? prev : all[0]?.id || null));
    });
  }, [family?.id]);

  // Doctors — a family-wide directory, not scoped to one person
  useEffect(() => {
    if (!family) {
      setCareTeam([]);
      return;
    }
    return subscribeCareTeam(family.id, setCareTeam);
  }, [family?.id]);

  // Per-person data — live
  useEffect(() => {
    if (!family || !currentPersonId) {
      setRecords([]);
      setMedications([]);
      setVisits([]);
      setNotifications([]);
      return;
    }
    const unsubs = [
      subscribeRecords(family.id, currentPersonId, setRecords),
      subscribeMedications(family.id, currentPersonId, setMedications),
      subscribeVisits(family.id, currentPersonId, setVisits),
      subscribeNotifications(family.id, currentPersonId, setNotifications),
    ];
    return () => unsubs.forEach((u) => u());
  }, [family?.id, currentPersonId]);

  if (authUser === undefined || (authUser && !userProfile)) {
    return <LoadingScreen error={loadError} />;
  }

  if (!authUser) return <SignInScreen />;
  if (!userProfile) return null;

  if (!userProfile.familyId) {
    return (
      <FamilyOnboarding
        user={userProfile}
        onFamilyReady={(familyId) => setUserProfile({ ...userProfile, familyId })}
      />
    );
  }

  if (!family || !isClaimSynced) {
    return <LoadingScreen error={loadError} />;
  }

  const currentPerson = people.find((p) => p.id === currentPersonId) || null;

  const handleAddPerson = async (newPerson: Person) => {
    await addPerson(family.id, newPerson);
    setCurrentPersonId(newPerson.id);
  };

  const handleVerifyFact = async (recordId: string, factId: string, verified: boolean) => {
    const record = records.find((r) => r.id === recordId);
    if (record) await verifyFactInRecord(family.id, record, factId, verified);
  };

  const handleAddRecord = (newRecord: DocumentRecord) => addRecord(family.id, newRecord);
  const handleUpdateRecord = (updatedRecord: DocumentRecord) => updateRecord(family.id, updatedRecord);
  const handleDeleteRecord = (recordId: string) => deleteRecord(family.id, recordId);
  const handleAddMedication = (newMed: Medication) => addMedication(family.id, newMed);
  const handleUpdateMedication = (updatedMed: Medication) => updateMedication(family.id, updatedMed);
  const handleDeleteMedication = (medId: string) => deleteMedication(family.id, medId);
  const handleAddVisit = (newVisit: Visit) => addVisit(family.id, newVisit);
  const handleUpdateVisit = (updatedVisit: Visit) => updateVisit(family.id, updatedVisit);
  const handleDeleteVisit = (visitId: string) => deleteVisit(family.id, visitId);
  const handleAddDoctor = (newDoc: CareTeamMember) => addCareTeamMember(family.id, newDoc);
  const handleUpdateDoctor = (updatedDoc: CareTeamMember) => updateCareTeamMember(family.id, updatedDoc);
  const handleDeleteDoctor = (docId: string) => deleteCareTeamMember(family.id, docId);
  const handleMarkNotificationRead = (id: string) => markNotificationRead(family.id, id);

  const handleSubmitAssistantQuery = async (query: string) => {
    if (!currentPerson) return;
    const history: ChatHistoryEntry[] = assistantMessages.map((m) => ({ role: m.role, text: m.text }));
    setAssistantMessages((prev) => [...prev, { id: `m-${Date.now()}-u`, role: 'user', text: query }]);
    setIsAssistantLoading(true);
    setIsAssistantDrawerOpen(true);

    try {
      const resp = await processAssistantQuery(family.id, query, currentPerson, records, medications, visits, careTeam, history);
      setAssistantMessages((prev) => [...prev, { id: `m-${Date.now()}-a`, role: 'assistant', text: resp.message, response: resp }]);
    } catch (e) {
      console.error(e);
      setAssistantMessages((prev) => [
        ...prev,
        { id: `m-${Date.now()}-a`, role: 'assistant', text: "Sorry, I couldn't process that — please try again." },
      ]);
    } finally {
      setIsAssistantLoading(false);
    }
  };

  const handleCloseAssistantDrawer = () => {
    setIsAssistantDrawerOpen(false);
    setAssistantMessages([]);
  };

  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

  if (!currentPerson) {
    return (
      <div className="h-full h-[100dvh] w-full bg-[#FBFAF6] flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-terracotta-light text-terracotta flex items-center justify-center">
          <IconUsers size={26} />
        </div>
        <div>
          <h2 className="font-serif text-lg text-ink-800">Add your first family member</h2>
          <p className="text-xs text-ink-500 mt-1 max-w-[260px]">
            Add a person or pet to start tracking records, medicines, and visits.
          </p>
        </div>
        <button
          onClick={() => setIsAddPersonOpen(true)}
          className="py-2.5 px-5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta-dark active:scale-98 transition-all"
        >
          Add family member
        </button>
        <AddPersonModal isOpen={isAddPersonOpen} onAddPerson={handleAddPerson} onClose={() => setIsAddPersonOpen(false)} />
      </div>
    );
  }

  return (
    <div className="h-full h-[100dvh] w-full bg-[#FBFAF6] md:bg-[#EAE6DC] flex flex-col items-center justify-center font-sans overflow-hidden">
      <div className="w-full h-full md:h-[min(880px,94dvh)] md:max-w-[412px] bg-paper-50 flex flex-col overflow-hidden relative md:rounded-[34px] md:shadow-modal md:border md:border-paper-400">
        <Header
          currentPerson={currentPerson}
          unreadNotifsCount={unreadNotifsCount}
          onOpenPersonSwitcher={() => setIsPersonSwitcherOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenHousehold={() => setIsHouseholdOpen(true)}
        />

        <main className="flex-1 flex flex-col overflow-hidden overscroll-contain">
          {activeTab === 'records' && (
            <RecordsTab
              familyId={family.id}
              personName={currentPerson.name}
              records={records}
              doctors={careTeam}
              medications={medications}
              onVerifyFact={handleVerifyFact}
              onUpdateRecord={handleUpdateRecord}
              onDeleteRecord={handleDeleteRecord}
              onAddMedication={handleAddMedication}
              onAddDoctor={handleAddDoctor}
            />
          )}

          {activeTab === 'medicines' && (
            <MedicinesTab
              medications={medications}
              onUpdateMedication={handleUpdateMedication}
              onDeleteMedication={handleDeleteMedication}
            />
          )}

          {activeTab === 'visits' && (
            <VisitsTab
              familyId={family.id}
              person={currentPerson}
              visits={visits}
              medications={medications}
              records={records}
              onUpdateVisit={handleUpdateVisit}
              onDeleteVisit={handleDeleteVisit}
            />
          )}

          {activeTab === 'doctors' && (
            <DoctorsTab
              doctors={careTeam}
              onAddDoctor={handleAddDoctor}
              onUpdateDoctor={handleUpdateDoctor}
              onDeleteDoctor={handleDeleteDoctor}
            />
          )}
        </main>

        <div className="flex-shrink-0 bg-paper-50">
          <AssistantBar
            onOpenCapture={() => setIsCaptureOpen(true)}
            onSubmitQuery={handleSubmitAssistantQuery}
          />
        </div>

        {!isKeyboardVisible && (
          <div className="flex-shrink-0">
            <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} />
          </div>
        )}

        <PersonSwitcherModal
          isOpen={isPersonSwitcherOpen}
          people={people}
          currentPerson={currentPerson}
          onSelectPerson={(p) => setCurrentPersonId(p.id)}
          onOpenAddMember={() => setIsAddPersonOpen(true)}
          onClose={() => setIsPersonSwitcherOpen(false)}
        />

        <AddPersonModal
          isOpen={isAddPersonOpen}
          onAddPerson={handleAddPerson}
          onClose={() => setIsAddPersonOpen(false)}
        />

        <NotificationsModal
          isOpen={isNotificationsOpen}
          notifications={notifications}
          onMarkRead={handleMarkNotificationRead}
          onNavigateToVerify={() => setActiveTab('records')}
          onClose={() => setIsNotificationsOpen(false)}
        />

        <HouseholdModal isOpen={isHouseholdOpen} family={family} onClose={() => setIsHouseholdOpen(false)} />

        <CaptureModal
          isOpen={isCaptureOpen}
          familyId={family.id}
          person={currentPerson}
          medications={medications}
          onAddRecord={handleAddRecord}
          onAddMedication={handleAddMedication}
          onClose={() => setIsCaptureOpen(false)}
        />

        <AssistantDrawer
          isOpen={isAssistantDrawerOpen}
          messages={assistantMessages}
          isLoading={isAssistantLoading}
          currentPerson={currentPerson}
          medications={medications}
          records={records}
          onSubmitQuery={handleSubmitAssistantQuery}
          onConfirmAddVisit={handleAddVisit}
          onConfirmAddMedication={handleAddMedication}
          onConfirmUpdateMedication={handleUpdateMedication}
          onClose={handleCloseAssistantDrawer}
        />
      </div>
    </div>
  );
};
