export const httpStatusMap = {
  400: { exception: 'BadRequestException', decorator: 'ApiBadRequestResponse' },
  401: {
    exception: 'UnauthorizedException',
    decorator: 'ApiUnauthorizedResponse',
  },
  403: { exception: 'ForbiddenException', decorator: 'ApiForbiddenResponse' },
  404: { exception: 'NotFoundException', decorator: 'ApiNotFoundResponse' },
  409: { exception: 'ConflictException', decorator: 'ApiConflictResponse' },
  410: { exception: 'GoneException', decorator: 'ApiGoneResponse' },
  422: {
    exception: 'UnprocessableEntityException',
    decorator: 'ApiUnprocessableEntityResponse',
  },
  500: {
    exception: 'InternalServerErrorException',
    decorator: 'ApiInternalServerErrorResponse',
  },
  502: { exception: 'BadGatewayException', decorator: 'ApiBadGatewayResponse' },
  503: {
    exception: 'ServiceUnavailableException',
    decorator: 'ApiServiceUnavailableResponse',
  },
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
