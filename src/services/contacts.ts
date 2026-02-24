/**
 * contacts.ts — Real Device Contacts Service
 *
 * Responsibilities:
 *  1. Request READ_CONTACTS permission from device
 *  2. Fetch & search all device contacts
 *  3. Manage a "trusted contacts" list persisted in AsyncStorage
 *     (these are the contacts shown on HomeScreen / Share Location / Emergency)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts';

// ─── Types ──────────────────────────────────────────────────────────
export interface TrustedContact {
    id: string;              // expo-contacts ID (device)
    name: string;
    phone: string;           // primary phone number
    relationship: string;   // user-assigned label e.g. "Brother", "Doctor"
    avatarColor?: string;   // auto-assigned color for avatar
    addedAt: number;        // timestamp
}

export interface DeviceContact {
    id: string;
    name: string;
    phone: string;          // first available phone number
    hasPhoto: boolean;
}

const STORAGE_KEY = 'safeconnect_trusted_contacts';
const AVATAR_COLORS = [
    '#E05A2B', '#2A7A5A', '#1565C0', '#8B1A1A',
    '#4A148C', '#006064', '#1B5E20', '#E65100',
];

// ─── Permission ─────────────────────────────────────────────────────
export async function requestContactsPermission(): Promise<boolean> {
    const { status } = await Contacts.requestPermissionsAsync();
    return status === 'granted';
}

export async function checkContactsPermission(): Promise<boolean> {
    const { status } = await Contacts.getPermissionsAsync();
    return status === 'granted';
}

// ─── Fetch all device contacts ───────────────────────────────────────
export async function fetchAllContacts(searchQuery = ''): Promise<DeviceContact[]> {
    const granted = await requestContactsPermission();
    if (!granted) return [];

    const { data } = await Contacts.getContactsAsync({
        fields: [
            Contacts.Fields.Name,
            Contacts.Fields.PhoneNumbers,
        ],
        sort: Contacts.SortTypes.FirstName,
    });

    const filtered = data
        .filter(c => c.name && c.phoneNumbers && c.phoneNumbers.length > 0)
        .map(c => ({
            id: c.id ?? `${c.name}-${Date.now()}`,
            name: c.name ?? 'Unknown',
            phone: normalisePhone(c.phoneNumbers?.[0]?.number ?? ''),
            hasPhoto: !!c.imageAvailable,
        }))
        .filter(c =>
            searchQuery.length === 0 ||
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.phone.includes(searchQuery)
        );

    return filtered;
}

// ─── Trusted Contacts CRUD ───────────────────────────────────────────
export async function getTrustedContacts(): Promise<TrustedContact[]> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as TrustedContact[]) : [];
    } catch {
        return [];
    }
}

export async function addTrustedContact(
    contact: DeviceContact,
    relationship: string
): Promise<TrustedContact[]> {
    const existing = await getTrustedContacts();

    // Don't add duplicates
    if (existing.some(c => c.id === contact.id)) {
        return existing;
    }

    const color = AVATAR_COLORS[existing.length % AVATAR_COLORS.length];
    const newContact: TrustedContact = {
        ...contact,
        relationship,
        avatarColor: color,
        addedAt: Date.now(),
    };

    const updated = [...existing, newContact];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
}

export async function updateTrustedContactRelationship(
    contactId: string,
    relationship: string
): Promise<TrustedContact[]> {
    const existing = await getTrustedContacts();
    const updated = existing.map(c =>
        c.id === contactId ? { ...c, relationship } : c
    );
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
}

export async function removeTrustedContact(contactId: string): Promise<TrustedContact[]> {
    const existing = await getTrustedContacts();
    const updated = existing.filter(c => c.id !== contactId);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
}

export async function reorderTrustedContacts(contacts: TrustedContact[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
}

// ─── Helpers ─────────────────────────────────────────────────────────
function normalisePhone(raw: string): string {
    // Strip spaces / dashes for consistent storage; keep + prefix
    return raw.replace(/[\s\-()]/g, '');
}

export function getInitials(name: string): string {
    return name
        .split(' ')
        .map(p => p.charAt(0))
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

export const contactsService = {
    requestPermission: requestContactsPermission,
    checkPermission: checkContactsPermission,
    fetchAll: fetchAllContacts,
    getTrusted: getTrustedContacts,
    addTrusted: addTrustedContact,
    updateRelationship: updateTrustedContactRelationship,
    removeTrusted: removeTrustedContact,
    reorder: reorderTrustedContacts,
    getInitials,
};

export default contactsService;
