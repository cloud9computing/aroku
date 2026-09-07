import { CareTeamMember, CareTeamPatientType, Species } from '../types';

export function patientTypeForSpecies(species: Species): CareTeamPatientType {
  return species === 'human' ? 'human' : 'pet';
}

// A doctor saved before patient_type existed has no way to know which list it
// belongs on — guessing from the specialty text (a vet's specialty almost
// always says so) beats silently hiding it from every view.
export function resolvePatientType(doctor: CareTeamMember): CareTeamPatientType {
  if (doctor.patient_type) return doctor.patient_type;
  return /vet/i.test(doctor.specialty) ? 'pet' : 'human';
}

export function filterDoctorsForSpecies(doctors: CareTeamMember[], species: Species): CareTeamMember[] {
  const wanted = patientTypeForSpecies(species);
  return doctors.filter((d) => resolvePatientType(d) === wanted);
}
