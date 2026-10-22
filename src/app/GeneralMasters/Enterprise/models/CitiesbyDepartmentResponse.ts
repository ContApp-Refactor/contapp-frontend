import { City } from '../../ThirdParties/models/City';

/**
 * Interface for Cities by Department Response
 * Matches backend response structure for cities endpoint
 */
export interface CitiesbyDepartmentResponse {
  cities: City[];
}