import {
  PrismaPersonalLayerRepository,
  PersonalLayerRecord,
} from '../../../infrastructure/database/repositories/prisma-personal-layer.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../domain/errors/forbidden.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';

export interface ApplyPersonalLayerStyleInput {
  userId: string;
  personalLayerId: string;
  color?: string;
  iconKey?: string;
  shape?: string;
}

/**
 * Contrairement à ApplyLayerStyleUseCase (couches du catalogue partagé, style appliqué via
 * PyQGIS sur le projet), une PersonalLayer de type FILE se rend uniquement côté client (vecteur
 * OpenLayers) - le style n'est donc qu'une simple mise à jour de métadonnée JSON, lue par le
 * frontend au rendu. Sans objet pour QGIS_PROJECT (déjà stylée nativement par le projet QGIS de
 * l'utilisateur).
 */
export class ApplyPersonalLayerStyleUseCase {
  constructor(private readonly personalLayerRepository: PrismaPersonalLayerRepository) {}

  async execute(input: ApplyPersonalLayerStyleInput): Promise<PersonalLayerRecord> {
    const layer = await this.personalLayerRepository.findById(input.personalLayerId);
    if (!layer) throw new NotFoundError('PersonalLayer', input.personalLayerId);
    if (layer.userId !== input.userId) {
      throw new ForbiddenError("Cette donnée ne vous appartient pas.");
    }
    if (layer.sourceType !== 'FILE') {
      throw new ValidationError(
        'Le style ne se configure que pour une donnée importée depuis un fichier.',
        {},
      );
    }

    // Fusionne avec le style existant (au lieu d'écraser) - sinon appliquer couleur/forme
    // effacerait un qmlPath déjà téléversé (UploadPersonalLayerQmlStyleUseCase), et vice-versa.
    const existingStyle = (layer.style as Record<string, unknown> | null) ?? {};
    return this.personalLayerRepository.updateStyle(input.personalLayerId, {
      ...existingStyle,
      color: input.color ?? (existingStyle['color'] as string | undefined),
      iconKey: input.iconKey ?? (existingStyle['iconKey'] as string | undefined),
      shape: input.shape ?? (existingStyle['shape'] as string | undefined),
    });
  }
}
