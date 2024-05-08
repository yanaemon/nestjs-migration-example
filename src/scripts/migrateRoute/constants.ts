export const httpStatusMap = {
  400: 'BadRequestException',
  401: 'UnauthorizedException',
  403: 'ForbiddenException',
  404: 'NotFoundException',
  409: 'ConflictException',
  410: 'GoneException',
  422: 'UnprocessableEntityException',
  500: 'InternalServerErrorException',
  502: 'BadGatewayException',
  503: 'ServiceUnavailableException',
}

export const functionHttpConfigMap = {
  get: { method: 'Get', path: 'id' },
  show: { method: 'Get', path: 'id' },
  index: { method: 'Get', path: null },
  list: { method: 'Get', path: null },
  create: { method: 'Post', path: null },
  update: { method: 'Put', path: 'id' },
  delete: { method: 'Delete', path: 'id' },
  remove: { method: 'Delete', path: 'id' },
}
