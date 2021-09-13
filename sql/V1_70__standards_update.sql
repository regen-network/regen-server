-- Move methodology and credit_class handle to methodology_version
-- and credit_class_version documentId
alter table credit_class_version add column documentId text;
alter table methodology_version add column documentId text;

update credit_class_version
set documentId=credit_class.handle
from credit_class
where credit_class.id = credit_class_version.id;

update methodology_version
set documentId=methodology.handle
from methodology
where methodology.id = methodology_version.id;

alter table credit_class drop column handle;
alter table methodology drop column handle;

-- Update methodology_version.metadata
update methodology_version set metadata = metadata ||
  jsonb_build_object('@type', 'http://regen.network/Methodology');

-- Update credit_class_version.metadata
update credit_class_version
set metadata = metadata || 
  jsonb_build_object(
    'http://regen.network/creditDenom', credit_class_version.metadata -> 'http://regen.network/creditClassUnit',
    '@type', 'http://regen.network/CreditClass'
  );
update credit_class_version set metadata = metadata - 'http://regen.network/creditClassUnit';

-- The standard for CarbonPlus Grasslands credit class is our Program Guide
update credit_class_version
set metadata = metadata ||
  jsonb_build_object('http://regen.network/standard',
    jsonb_build_object(
      'http://schema.org/name', 'Regen Registry Program Guide',
      'http://regen.network/documentId', credit_class_version.metadata -> 'programGuide' -> 'handle',
      'http://schema.org/version', credit_class_version.metadata -> 'programGuide' -> 'version',
      'http://schema.org/url', 'https://regen-registry.s3.amazonaws.com/Regen+Registry+Program+Guide.pdf'
    )
  )
where name='Carbon<i>Plus</i> Grasslands';
update credit_class_version set metadata = metadata - 'programGuide';

update credit_class_version
set metadata = metadata ||
  jsonb_build_object('http://regen.network/standard',
    jsonb_build_object(
      'http://schema.org/name', 'VCS',
      'http://schema.org/version', credit_class_version.version,
      'http://schema.org/url', credit_class_version.metadata -> 'http://regen.network/standardUrl'
    )
  ), version = ''
where name='REDD+';
update credit_class_version set metadata = metadata - 'http://regen.network/standardUrl';

-- Update project.metadata
update project
set metadata = metadata ||
  jsonb_build_object('http://regen.network/additionalCertification',
    jsonb_build_object(
      'http://schema.org/name', 'CCB',
      'http://schema.org/version', 'Second Edition',
      'http://schema.org/url', 'https://verra.org/project/ccb-program/'
    )
  ) ||
  jsonb_build_object('http://regen.network/externalProjectUrl', project.metadata -> 'http://regen.network/externalProjectPageLink')
where handle='kasigau';

update project set metadata = metadata - 'http://regen.network/externalProjectPageLink';
update project set metadata = jsonb_set(metadata, '{@type}',
  jsonb_build_array(project.metadata -> '@type', 'http://regen.network/Project')
);

-- Update credit_vintage.metadata
update credit_vintage set metadata = metadata ||
  jsonb_build_object('http://regen.network/additionalCertifications',
    jsonb_build_object('@list', credit_vintage.metadata -> 'http://regen.network/additionalCertifications')
  ) ||
  jsonb_build_object('@type', 'http://regen.network/CreditVintage');

-- Update retirement.metadata
update retirement set metadata = metadata ||
  jsonb_build_object('@type', 'http://regen.network/Retirement');


