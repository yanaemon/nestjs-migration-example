

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